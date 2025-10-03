/**
 * Realistic headers collection for avoiding automation detection
 * Contains real browser headers from different browsers, OS, and versions
 */

class HeadersManager {
  constructor() {
    this.userAgents = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      
      // Firefox on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      
      // Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      
      // Safari on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      
      // Chrome on Linux
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      
      // Firefox on Linux
      'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
      
      // Edge on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.52',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.2277.83',
    ];

    this.acceptLanguages = [
      'en-US,en;q=0.9',
      'en-US,en;q=0.9,es;q=0.8',
      'en-US,en;q=0.9,fr;q=0.8',
      'en-US,en;q=0.9,pt;q=0.8',
      'en-US,en;q=0.9,de;q=0.8',
      'en-GB,en;q=0.9,en-US;q=0.8',
      'pt-BR,pt;q=0.9,en;q=0.8',
      'es-ES,es;q=0.9,en;q=0.8',
      'fr-FR,fr;q=0.9,en;q=0.8',
      'de-DE,de;q=0.9,en;q=0.8',
    ];

    this.acceptEncodings = [
      'gzip, deflate, br, zstd',
      'gzip, deflate, br',
      'gzip, deflate',
    ];

    this.secFetchSites = ['same-origin', 'same-site', 'cross-site', 'none'];
    this.secFetchModes = ['navigate', 'cors', 'no-cors', 'same-origin'];
    this.secFetchUsers = ['?1', '?0'];
    this.secFetchDests = ['document', 'empty', 'script', 'style', 'image'];

    // Cache for consistent headers within a session
    this.sessionHeaders = null;
  }

  /**
   * Get a random element from an array
   */
  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Get random realistic headers for browser context
   */
  getRandomBrowserHeaders() {
    if (this.sessionHeaders) {
      return this.sessionHeaders;
    }

    const userAgent = this.getRandomElement(this.userAgents);
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    const isFirefox = userAgent.includes('Firefox');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isEdge = userAgent.includes('Edg');

    const headers = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': this.getRandomElement(this.acceptLanguages),
      'Accept-Encoding': this.getRandomElement(this.acceptEncodings),
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'DNT': Math.random() > 0.7 ? '1' : undefined, // ~30% of users have DNT enabled
    };

    // Add browser-specific headers
    if (isChrome || isEdge) {
      headers['sec-ch-ua'] = this.getChromiumSecChUa(userAgent);
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = this.getPlatformFromUA(userAgent);
      headers['Sec-Fetch-Site'] = this.getRandomElement(this.secFetchSites);
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-User'] = '?1';
      headers['Sec-Fetch-Dest'] = 'document';
    }

    // Cache for session consistency
    this.sessionHeaders = headers;
    return headers;
  }

  /**
   * Get random realistic headers for HTTP requests (like downloads)
   */
  getRandomDownloadHeaders() {
    const userAgent = this.getRandomElement(this.userAgents);
    
    return {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Language': this.getRandomElement(this.acceptLanguages),
      'Accept-Encoding': this.getRandomElement(this.acceptEncodings),
      'Connection': 'keep-alive',
      'Referer': 'https://gofile.io/',
      'Origin': 'https://gofile.io',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
  }

  /**
   * Generate sec-ch-ua header for Chromium browsers
   */
  getChromiumSecChUa(userAgent) {
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    if (!chromeMatch) return undefined;
    
    const version = parseInt(chromeMatch[1]);
    const brandVersion = Math.floor(version / 8) * 8; // Round to nearest 8 for brand version
    
    if (userAgent.includes('Edg')) {
      return `"Microsoft Edge";v="${version}", "Chromium";v="${version}", "Not=A?Brand";v="${brandVersion}"`;
    } else {
      return `"Google Chrome";v="${version}", "Chromium";v="${version}", "Not=A?Brand";v="${brandVersion}"`;
    }
  }

  /**
   * Extract platform from user agent
   */
  getPlatformFromUA(userAgent) {
    if (userAgent.includes('Windows')) return '"Windows"';
    if (userAgent.includes('Macintosh')) return '"macOS"';
    if (userAgent.includes('Linux')) return '"Linux"';
    return '"Unknown"';
  }

  /**
   * Reset session headers (call this for each new session/URL)
   */
  resetSession() {
    this.sessionHeaders = null;
  }

  /**
   * Add random delay to simulate human behavior
   */
  async addRandomDelay() {
    const delay = Math.random() * 2000 + 500; // 500-2500ms random delay
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get random viewport size
   */
  getRandomViewport() {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1600, height: 900 },
      { width: 2560, height: 1440 },
    ];
    
    return this.getRandomElement(viewports);
  }
}

module.exports = HeadersManager;