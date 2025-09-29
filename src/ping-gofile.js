const { chromium } = require('playwright');
const HeadersManager = require('./headers');

class GoFileKeepAlive {
  constructor(options = {}) {
    this.options = {
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      timeout: parseInt(process.env.PAGE_TIMEOUT) || 60000,
      waitTime: parseInt(process.env.WAIT_TIME) || 5000,
      headless: process.env.HEADLESS !== 'false',
      userAgent: process.env.USER_AGENT || null, // Will be set by HeadersManager
      verbose: process.env.VERBOSE === 'true',
      ...options
    };
    
    this.headersManager = new HeadersManager();
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
    this.log('Launching browser with stealth configuration...');
    
    // Reset headers for new session
    this.headersManager.resetSession();
    const browserHeaders = this.headersManager.getRandomBrowserHeaders();
    const viewport = this.headersManager.getRandomViewport();
    
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
        '--disable-extensions',
        // Additional stealth arguments
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--no-pings',
        '--disable-web-security',
        '--disable-features=site-per-process'
      ]
    };

    // Use system chromium if available (for Docker/Alpine)
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    
    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      userAgent: browserHeaders['User-Agent'],
      viewport: viewport,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: browserHeaders,
      locale: 'en-US',
      timezoneId: 'America/New_York', // Common timezone
      permissions: ['geolocation', 'notifications'], // Common permissions
    });

    // Add stealth script to hide automation
    await context.addInitScript(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override chrome property
      window.chrome = {
        runtime: {},
      };

      // Hide automation indicators
      const originalQuery = window.document.querySelector;
      window.document.querySelector = function(selector) {
        if (selector === 'img[src*="data:image/png;base64,"]') {
          return null;
        }
        return originalQuery.call(this, selector);
      };
    });

    // Block unnecessary resources but allow more than before for realistic behavior
    await context.route('**/*', route => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();
      
      // Block some images and fonts but not all to appear more realistic
      if (resourceType === 'image' && Math.random() > 0.3) { // Block 70% of images
        return route.abort();
      }
      if (resourceType === 'font' && Math.random() > 0.5) { // Block 50% of fonts
        return route.abort();
      }
      if (resourceType === 'media') {
        return route.abort();
      }
      
      route.continue();
    });

    this.log(`Browser configured with User-Agent: ${browserHeaders['User-Agent']}`, 'debug');
    this.log(`Viewport: ${viewport.width}x${viewport.height}`, 'debug');

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
    
    // Add random delay before navigation
    await this.headersManager.addRandomDelay();
    
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: this.options.timeout 
    });

    // Simulate human-like behavior
    await this.simulateHumanBehavior(page);

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
            // Add random delay and simulate mouse movement
            await this.headersManager.addRandomDelay();
            
            const text = (await element.innerText()).toLowerCase();
            if (/download|baixar|télécharger|descargar|scarica/.test(text)) {
              // Hover before clicking for more realistic behavior
              await element.hover();
              await this.sleep(Math.random() * 500 + 200); // 200-700ms delay
              
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

  /**
   * Simulate human-like behavior on the page
   */
  async simulateHumanBehavior(page) {
    try {
      // Random scroll behavior
      const scrolls = Math.floor(Math.random() * 3) + 1; // 1-3 scrolls
      for (let i = 0; i < scrolls; i++) {
        const scrollY = Math.random() * 500 + 100; // 100-600px scroll
        await page.evaluate((y) => window.scrollBy(0, y), scrollY);
        await this.sleep(Math.random() * 1000 + 500); // 500-1500ms delay
      }

      // Random mouse movements
      const movements = Math.floor(Math.random() * 3) + 1; // 1-3 movements
      for (let i = 0; i < movements; i++) {
        const x = Math.random() * 800 + 100; // Random x position
        const y = Math.random() * 600 + 100; // Random y position
        await page.mouse.move(x, y);
        await this.sleep(Math.random() * 200 + 100); // 100-300ms delay
      }

      // Occasionally move cursor over elements
      if (Math.random() > 0.5) {
        try {
          const buttons = await page.$$('button, a, input');
          if (buttons.length > 0) {
            const randomButton = buttons[Math.floor(Math.random() * buttons.length)];
            await randomButton.hover();
            await this.sleep(Math.random() * 500 + 200);
          }
        } catch (e) {
          // Ignore errors in simulation
        }
      }
    } catch (error) {
      this.log(`Error in human behavior simulation: ${error.message}`, 'debug');
    }
  }

  async downloadSampleFromLink(url) {
    try {
      this.log(`Downloading 1MB sample from: ${url}`, 'debug');
      
      // Get random headers for the download request
      const downloadHeaders = this.headersManager.getRandomDownloadHeaders();
      
      // Add Range header for partial download
      downloadHeaders['Range'] = 'bytes=0-1048575'; // Request first 1MB (1,048,576 bytes - 1)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: downloadHeaders,
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
    this.log('Starting GoFile Keep Alive process (downloading 1MB samples with stealth features)...');

    let browser, context;
    
    try {
      const urls = this.parseUrls();
      ({ browser, context } = await this.setupBrowser());

      let totalSuccessfulDownloads = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          // Add random delay between URLs to appear more human-like
          if (i > 0) {
            const delay = Math.random() * 5000 + 2000; // 2-7 second delay between URLs
            this.log(`Adding ${Math.round(delay)}ms delay before processing next URL`, 'debug');
            await this.sleep(delay);
          }

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

      this.log('✓ GoFile Keep Alive process completed successfully with enhanced stealth features');
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