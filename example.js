#!/usr/bin/env node

/**
 * Example usage of GoFile Keep Alive
 * This script demonstrates how to use the tool programmatically
 */

const GoFileKeepAlive = require('./src/ping-gofile');

async function example() {
  console.log('🔄 GoFile Keep Alive Example');
  console.log('================================\n');

  // Example 1: Basic usage with default options
  console.log('📝 Example 1: Basic usage');
  
  const keepAlive1 = new GoFileKeepAlive({
    verbose: true,
    maxRetries: 2
  });

  // Mock environment variable for demo
  process.env.GOFILE_URLS = 'https://example.com/demo1\nhttps://example.com/demo2';
  
  try {
    console.log('Parsing URLs...');
    const urls = keepAlive1.parseUrls();
    console.log(`✅ Found ${urls.length} URLs to process`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 2: Custom configuration
  console.log('📝 Example 2: Custom configuration');
  
  const customOptions = {
    maxRetries: 5,
    timeout: 30000,
    waitTime: 3000,
    verbose: true,
    userAgent: 'Custom Bot/1.0'
  };

  const keepAlive2 = new GoFileKeepAlive(customOptions);
  
  console.log('Custom options:');
  console.log(`- Max retries: ${keepAlive2.options.maxRetries}`);
  console.log(`- Timeout: ${keepAlive2.options.timeout}ms`);
  console.log(`- Wait time: ${keepAlive2.options.waitTime}ms`);
  console.log(`- User agent: ${keepAlive2.options.userAgent}`);

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 3: Environment variable configuration
  console.log('📝 Example 3: Environment variables');
  console.log('Set these environment variables to configure the tool:');
  console.log('');
  console.log('GOFILE_URLS="https://gofile.io/d/abc123"');
  console.log('VERBOSE=true');
  console.log('MAX_RETRIES=5');
  console.log('PAGE_TIMEOUT=30000');
  console.log('HEADLESS=false');
  console.log('');
  console.log('Then run: npm start');

  console.log('\n' + '='.repeat(50) + '\n');
  console.log('✨ For more examples, check the README.md file');
  console.log('🐛 For issues, enable verbose logging with VERBOSE=true');
}

if (require.main === module) {
  example().catch(console.error);
}

module.exports = { example };