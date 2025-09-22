const { chromium } = require('playwright');

class GoFileKeepAlive {
  constructor(options = {}) {
    this.options = {
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      timeout: parseInt(process.env.PAGE_TIMEOUT) || 60000,
      waitTime: parseInt(process.env.WAIT_TIME) || 5000,
      headless: process.env.HEADLESS !== 'false',
      userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      verbose: process.env.VERBOSE === 'true',
      ...options
    };
    
    this.stats = {
      totalUrls: 0,
      totalLinks: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      errors: []
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else if (level === 'debug' && this.options.verbose) {
      console.log(`${prefix} ${message}`);
    } else if (level === 'info') {
      console.log(`${prefix} ${message}`);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryOperation(operation, maxRetries = this.options.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.log(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`, 'warn');
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  parseUrls() {
    const urlsEnv = process.env.GOFILE_URLS || '';
    const urls = urlsEnv.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(url => {
        try {
          new URL(url);
          return true;
        } catch (e) {
          this.log(`Invalid URL format: ${url}`, 'warn');
          return false;
        }
      });

    if (urls.length === 0) {
      throw new Error('No valid URLs found in GOFILE_URLS environment variable');
    }

    this.stats.totalUrls = urls.length;
    this.log(`Found ${urls.length} valid URLs to process`);
    return urls;
  }

  async setupBrowser() {
    this.log('Launching browser...');
    
    const launchOptions = {
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-extensions'
      ]
    };

    // Use system chromium if available (for Docker/Alpine)
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    
    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      userAgent: this.options.userAgent,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });

    // Block unnecessary resources to improve performance
    await context.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        return route.abort();
      }
      route.continue();
    });

    return { browser, context };
  }

  async findDownloadLinks(page, url) {
    const downloadLinks = new Set();
    
    // Monitor network responses for download links
    page.on('response', response => {
      try {
        const responseUrl = response.url();
        const hostname = new URL(responseUrl).hostname;
        
        if (/\/download\//.test(responseUrl) || /srv-store\d+\.gofile\.io/.test(hostname)) {
          downloadLinks.add(responseUrl);
          this.log(`Detected download link: ${responseUrl}`, 'debug');
        }
      } catch (e) {
        this.log(`Error parsing response URL: ${e.message}`, 'debug');
      }
    });

    this.log(`Navigating to ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: this.options.timeout 
    });

    // Try to find and click download buttons
    const downloadSelectors = [
      'a[href*="/download/"]',
      'button:has-text("download")',
      'button:has-text("baixar")',
      'button:has-text("télécharger")',
      'button:has-text("descargar")',
      'button:has-text("scarica")',
      '[data-cy="download"]',
      '.download-button',
      '#download',
      '.btn-download'
    ];

    for (const selector of downloadSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          try {
            const text = (await element.innerText()).toLowerCase();
            if (/download|baixar|télécharger|descargar|scarica/.test(text)) {
              await element.click({ timeout: 5000 });
              await this.sleep(this.options.waitTime);
              this.log(`Clicked download button with text: ${text}`, 'debug');
            }
          } catch (e) {
            this.log(`Error clicking element: ${e.message}`, 'debug');
          }
        }
      } catch (e) {
        this.log(`Error finding elements with selector ${selector}: ${e.message}`, 'debug');
      }
    }

    // Extract direct download links from the page
    try {
      const pageLinks = await page.$$eval('a[href*="/download/"]', 
        elements => elements.map(el => el.href)
      );
      pageLinks.forEach(link => downloadLinks.add(link));
    } catch (e) {
      this.log(`Error extracting page links: ${e.message}`, 'debug');
    }

    return Array.from(downloadLinks);
  }

  async downloadSampleFromLink(url) {
    try {
      this.log(`Downloading 1MB sample from: ${url}`, 'debug');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.options.userAgent,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Range': 'bytes=0-1048575' // Request first 1MB (1,048,576 bytes - 1)
        },
        timeout: 60000 // Increased timeout for actual download
      });

      if (response.status === 200 || response.status === 206) {
        // Read the response body to actually download the data
        const reader = response.body?.getReader();
        let downloadedBytes = 0;
        const maxBytes = 1048576; // 1MB
        
        if (reader) {
          try {
            while (downloadedBytes < maxBytes) {
              const { done, value } = await reader.read();
              if (done) break;
              downloadedBytes += value?.length || 0;
            }
          } finally {
            reader.releaseLock();
          }
        }
        
        this.stats.successfulDownloads++;
        this.log(`✓ Downloaded ${downloadedBytes} bytes from: ${url} -> ${response.status} ${response.statusText}`);
        return true;
      } else {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.stats.failedDownloads++;
      this.stats.errors.push({ url, error: error.message });
      this.log(`✗ Download failed: ${url} -> ${error.message}`, 'warn');
      return false;
    }
  }

  async processUrl(context, url) {
    const page = await context.newPage();
    
    try {
      const downloadLinks = await this.retryOperation(async () => {
        return await this.findDownloadLinks(page, url);
      });

      if (downloadLinks.length === 0) {
        this.log(`⚠ No download links found for: ${url}`, 'warn');
        return 0;
      }

      this.log(`Found ${downloadLinks.length} download links for ${url}`);
      this.stats.totalLinks += downloadLinks.length;

      // Download 1MB samples from all download links with retry logic
      let successCount = 0;
      for (const downloadLink of downloadLinks) {
        const success = await this.retryOperation(async () => {
          const result = await this.downloadSampleFromLink(downloadLink);
          if (!result) {
            throw new Error('Download failed');
          }
          return result;
        }, 2); // Fewer retries for individual downloads

        if (success) {
          successCount++;
        }
      }

      return successCount;
    } finally {
      if (!page.isClosed()) {
        await page.close();
      }
    }
  }

  async run() {
    const startTime = Date.now();
    this.log('Starting GoFile Keep Alive process (downloading 1MB samples)...');

    let browser, context;
    
    try {
      const urls = this.parseUrls();
      ({ browser, context } = await this.setupBrowser());

      let totalSuccessfulDownloads = 0;

      for (const url of urls) {
        try {
          const successfulDownloads = await this.processUrl(context, url);
          totalSuccessfulDownloads += successfulDownloads;
        } catch (error) {
          this.log(`Failed to process URL ${url}: ${error.message}`, 'error');
          this.stats.errors.push({ url, error: error.message });
        }
      }

      // Print summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.log('='.repeat(60));
      this.log('SUMMARY');
      this.log('='.repeat(60));
      this.log(`Execution time: ${duration}s`);
      this.log(`URLs processed: ${this.stats.totalUrls}`);
      this.log(`Download links found: ${this.stats.totalLinks}`);
      this.log(`Successful downloads: ${this.stats.successfulDownloads}`);
      this.log(`Failed downloads: ${this.stats.failedDownloads}`);
      
      if (this.stats.errors.length > 0) {
        this.log(`Errors encountered: ${this.stats.errors.length}`);
        if (this.options.verbose) {
          this.stats.errors.forEach((error, index) => {
            this.log(`  ${index + 1}. ${error.url}: ${error.error}`, 'error');
          });
        }
      }

      if (this.stats.successfulDownloads === 0 && this.stats.totalLinks > 0) {
        throw new Error('No successful downloads were made despite finding download links');
      }

      this.log('✓ GoFile Keep Alive process completed successfully');
      return this.stats;
      
    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        this.log('Browser closed');
      }
    }
  }
}

// Main execution
if (require.main === module) {
  const keepAlive = new GoFileKeepAlive();
  
  keepAlive.run()
    .then(stats => {
      console.log('Process completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Process failed:', error.message);
      process.exit(1);
    });
}

module.exports = GoFileKeepAlive;