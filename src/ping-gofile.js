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
          // Check if error is rate limiting (429) - use longer delays
          const isRateLimited = error.message && error.message.includes('429');
          let delay;
          
          if (isRateLimited) {
            // For rate limiting, use much longer delays: 10s, 30s, 60s
            delay = Math.min(10000 * Math.pow(3, attempt - 1), 60000);
          } else {
            // For other errors, use standard exponential backoff
            delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          }
          
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
        // Additional stealth arguments (reduced set for stability)
        '--disable-blink-features=AutomationControlled'
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
      ignoreHTTPSErrors: true
    });

    // Add minimal stealth script to hide automation
    await context.addInitScript(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    // Block unnecessary resources for performance
    await context.route('**/*', route => {
      const resourceType = route.request().resourceType();
      
      // Block media, stylesheets, and images to reduce memory usage
      if (['media', 'stylesheet', 'image', 'font'].includes(resourceType)) {
        return route.abort();
      }
      
      route.continue();
    });

    this.log(`Browser configured with User-Agent: ${browserHeaders['User-Agent']}`, 'debug');
    this.log(`Viewport: ${viewport.width}x${viewport.height}`, 'debug');

    return { browser, context };
  }

  /**
   * Check if browser and context are still alive
   */
  async isBrowserAlive(browser, context) {
    try {
      if (!browser || !browser.isConnected()) {
        return false;
      }
      if (!context || context.pages === undefined) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
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
    
    // Small delay before navigation
    await this.sleep(500);
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: this.options.timeout 
    });
    
    // Wait longer for dynamic content to load on GoFile pages
    this.log(`Waiting for dynamic content to load...`, 'debug');
    await this.sleep(5000); // Increased from 2s to 5s for better reliability

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
      '.btn-download',
      '[class*="download"]',
      '[id*="download"]',
      'a[class*="btn"]',
      'button[class*="btn"]'
    ];

    this.log(`Searching for download buttons...`, 'debug');
    let clickedButtons = 0;
    
    for (const selector of downloadSelectors) {
      try {
        const elements = await page.$$(selector);
        this.log(`Found ${elements.length} elements for selector: ${selector}`, 'debug');
        
        for (const element of elements) {
          try {
            const isVisible = await element.isVisible();
            if (!isVisible) continue;
            
            const text = (await element.innerText()).toLowerCase();
            this.log(`Checking element with text: "${text}"`, 'debug');
            
            if (/download|baixar|télécharger|descargar|scarica|get|obter/.test(text)) {
              // Small delay before clicking
              await this.sleep(Math.random() * 300 + 200); // 200-500ms delay
              
              await element.click({ timeout: 5000 });
              clickedButtons++;
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
    
    this.log(`Clicked ${clickedButtons} download buttons`, 'debug');

    // Extract direct download links from the page
    try {
      const pageLinks = await page.$$eval('a[href*="/download/"]', 
        elements => elements.map(el => el.href)
      );
      this.log(`Found ${pageLinks.length} direct download links on page`, 'debug');
      pageLinks.forEach(link => downloadLinks.add(link));
    } catch (e) {
      this.log(`Error extracting page links: ${e.message}`, 'debug');
    }
    
    // Also check for links in the page content that match GoFile download patterns
    try {
      const allLinks = await page.$$eval('a[href]', 
        elements => elements.map(el => el.href).filter(href => 
          href.includes('srv-store') || href.includes('/download/') || href.includes('gofile.io/download')
        )
      );
      this.log(`Found ${allLinks.length} GoFile-related links in page content`, 'debug');
      allLinks.forEach(link => downloadLinks.add(link));
    } catch (e) {
      this.log(`Error extracting GoFile links: ${e.message}`, 'debug');
    }

    return Array.from(downloadLinks);
  }

  /**
   * Simulate human-like behavior on the page
   */
  async simulateHumanBehavior(page) {
    try {
      // Simple scroll behavior
      const scrollY = Math.random() * 300 + 100; // 100-400px scroll
      await page.evaluate((y) => window.scrollBy(0, y), scrollY);
      await this.sleep(Math.random() * 500 + 300); // 300-800ms delay
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
    let page = null;
    
    try {
      // Retry the entire page creation and navigation process
      const downloadLinks = await this.retryOperation(async () => {
        // Close previous page if it exists and is not closed
        if (page && !page.isClosed()) {
          try {
            await page.close();
          } catch (e) {
            this.log(`Error closing previous page: ${e.message}`, 'debug');
          }
        }
        
        // Verify context is still valid before creating new page
        if (!context || !context.pages) {
          throw new Error('Browser context is no longer valid');
        }
        
        // Create a fresh page for each attempt
        page = await context.newPage();
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
    } catch (error) {
      this.log(`Error processing URL ${url}: ${error.message}`, 'error');
      throw error;
    } finally {
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (e) {
          this.log(`Error closing page: ${e.message}`, 'debug');
        }
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

          // Check if browser is still alive before processing
          const browserAlive = await this.isBrowserAlive(browser, context);
          if (!browserAlive) {
            this.log('Browser/context is no longer alive, recreating...', 'warn');
            
            // Close old browser if it exists
            try {
              if (browser) {
                await browser.close();
              }
            } catch (e) {
              this.log(`Error closing old browser: ${e.message}`, 'debug');
            }
            
            // Create new browser and context
            ({ browser, context } = await this.setupBrowser());
          }

          const successfulDownloads = await this.processUrl(context, url);
          totalSuccessfulDownloads += successfulDownloads;
        } catch (error) {
          this.log(`Failed to process URL ${url}: ${error.message}`, 'error');
          this.stats.errors.push({ url, error: error.message });
          
          // If error indicates browser issues, try to recreate browser for next URL
          if (error.message && (error.message.includes('closed') || error.message.includes('Target'))) {
            this.log('Browser issue detected, will recreate for next URL', 'warn');
            try {
              if (browser) {
                await browser.close();
              }
            } catch (e) {
              this.log(`Error closing browser after error: ${e.message}`, 'debug');
            }
            // Set to null so it gets recreated on next iteration
            browser = null;
            context = null;
          }
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
        try {
          await browser.close();
          this.log('Browser closed');
        } catch (e) {
          this.log(`Error closing browser in finally: ${e.message}`, 'debug');
        }
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