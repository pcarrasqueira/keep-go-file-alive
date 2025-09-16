const GoFileKeepAlive = require('../src/ping-gofile');

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, but got ${actual}`);
    }
  }

  async assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message || 'Expected condition to be true');
    }
  }

  async run() {
    console.log('Running tests...\n');

    for (const { name, fn } of this.tests) {
      try {
        console.log(`Testing: ${name}`);
        await fn();
        console.log('✓ PASSED\n');
        this.passed++;
      } catch (error) {
        console.log(`✗ FAILED: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log('='.repeat(50));
    console.log(`Tests completed: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

const runner = new TestRunner();

// Test GoFileKeepAlive class instantiation
runner.test('GoFileKeepAlive class instantiation', async () => {
  const keepAlive = new GoFileKeepAlive();
  await runner.assertTrue(keepAlive instanceof GoFileKeepAlive, 'Should create GoFileKeepAlive instance');
  await runner.assertEqual(typeof keepAlive.options, 'object', 'Should have options object');
  await runner.assertEqual(typeof keepAlive.stats, 'object', 'Should have stats object');
});

// Test options configuration
runner.test('Options configuration', async () => {
  const customOptions = {
    maxRetries: 5,
    timeout: 30000,
    verbose: true
  };
  
  const keepAlive = new GoFileKeepAlive(customOptions);
  await runner.assertEqual(keepAlive.options.maxRetries, 5, 'Should set custom maxRetries');
  await runner.assertEqual(keepAlive.options.timeout, 30000, 'Should set custom timeout');
  await runner.assertEqual(keepAlive.options.verbose, true, 'Should set custom verbose');
});

// Test environment variable parsing
runner.test('Environment variable parsing', async () => {
  // Save original env
  const originalEnv = process.env.GOFILE_URLS;
  
  try {
    // Test with no URLs
    delete process.env.GOFILE_URLS;
    const keepAlive1 = new GoFileKeepAlive();
    
    try {
      keepAlive1.parseUrls();
      throw new Error('Should have thrown error for empty URLs');
    } catch (error) {
      await runner.assertTrue(error.message.includes('No valid URLs found'), 'Should throw error for empty URLs');
    }

    // Test with valid URLs
    process.env.GOFILE_URLS = 'https://gofile.io/d/abc123\nhttps://gofile.io/d/def456';
    const keepAlive2 = new GoFileKeepAlive();
    const urls = keepAlive2.parseUrls();
    await runner.assertEqual(urls.length, 2, 'Should parse 2 URLs');
    
  } finally {
    // Restore original env
    if (originalEnv) {
      process.env.GOFILE_URLS = originalEnv;
    } else {
      delete process.env.GOFILE_URLS;
    }
  }
});

// Test logging functionality
runner.test('Logging functionality', async () => {
  const keepAlive = new GoFileKeepAlive({ verbose: true });
  
  // Capture console output
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  let logOutput = [];
  console.log = (msg) => logOutput.push({ type: 'log', message: msg });
  console.error = (msg) => logOutput.push({ type: 'error', message: msg });
  console.warn = (msg) => logOutput.push({ type: 'warn', message: msg });
  
  try {
    keepAlive.log('Test info message', 'info');
    keepAlive.log('Test error message', 'error');
    keepAlive.log('Test debug message', 'debug');
    
    await runner.assertEqual(logOutput.length, 3, 'Should log 3 messages');
    await runner.assertTrue(logOutput[0].message.includes('Test info message'), 'Should log info message');
    await runner.assertTrue(logOutput[1].message.includes('Test error message'), 'Should log error message');
    await runner.assertTrue(logOutput[2].message.includes('Test debug message'), 'Should log debug message in verbose mode');
    
  } finally {
    // Restore console
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
});

// Test sleep function
runner.test('Sleep function', async () => {
  const keepAlive = new GoFileKeepAlive();
  const start = Date.now();
  await keepAlive.sleep(100);
  const elapsed = Date.now() - start;
  
  await runner.assertTrue(elapsed >= 90 && elapsed <= 150, `Sleep should take ~100ms, took ${elapsed}ms`);
});

// Test URL validation
runner.test('URL validation', async () => {
  const originalEnv = process.env.GOFILE_URLS;
  
  try {
    // Test with invalid URLs
    process.env.GOFILE_URLS = 'invalid-url\nhttp://valid.com\nanother-invalid';
    const keepAlive = new GoFileKeepAlive();
    const urls = keepAlive.parseUrls();
    
    await runner.assertEqual(urls.length, 1, 'Should filter out invalid URLs');
    await runner.assertEqual(urls[0], 'http://valid.com', 'Should keep valid URL');
    
  } finally {
    if (originalEnv) {
      process.env.GOFILE_URLS = originalEnv;
    } else {
      delete process.env.GOFILE_URLS;
    }
  }
});

// Run all tests
if (require.main === module) {
  runner.run().catch(console.error);
}

module.exports = TestRunner;