# Keep GoFile Alive 

[![Keep Gofile Alive](https://github.com/pcarrasqueira/keep-go-file-alive/actions/workflows/keep-file-alive.yml/badge.svg?branch=main)](https://github.com/pcarrasqueira/keep-go-file-alive/actions/workflows/keep-file-alive.yml)

This repository contains a GitHub Action that periodically pings GoFile download links to keep them alive and prevent expiration. The tool uses Playwright to automate browser interactions and intelligently detect download links.

## ✨ Features

- **Automated Link Detection**: Intelligently finds download links on GoFile pages
- **Multi-language Support**: Recognizes download buttons in multiple languages (English, Portuguese, French, Spanish, Italian)
- **Robust Error Handling**: Comprehensive retry logic and error recovery
- **Detailed Logging**: Configurable logging levels with comprehensive status reporting
- **Performance Optimized**: Blocks unnecessary resources (images, stylesheets) for faster execution
- **Configurable**: Multiple environment variables for customization

## 🚀 Usage

### Option 1: Fork this Repository

1. Fork this repository to your GitHub account
2. Go to your forked repository's Settings → Secrets and Variables → Actions
3. Create a new repository secret named `GOFILE_URLS`
4. Add your GoFile URLs, one per line:
   ```
   https://gofile.io/d/abc123
   https://gofile.io/d/def456
   https://gofile.io/d/xyz789
   ```
5. The action will run automatically every 5 days at 7:00 AM UTC, or you can trigger it manually

### Option 2: Use in Your Own Repository

1. Copy the `.github/workflows/keep-file-alive.yml` file to your repository
2. Copy the `src/ping-gofile.js` file and `package.json` 
3. Set up the `GOFILE_URLS` secret as described above

### Option 3: Manual Usage

You can also run the tool locally:

```bash
# Install dependencies
npm install

# Set environment variable and run
export GOFILE_URLS="https://gofile.io/d/abc123
https://gofile.io/d/def456"
npm start
```

## ⚙️ Configuration

The tool supports several environment variables for customization:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `GOFILE_URLS` | URLs to process (newline-separated) | Required | `https://gofile.io/d/abc123` |
| `VERBOSE` | Enable detailed logging | `false` | `true`/`false` |
| `MAX_RETRIES` | Maximum retry attempts | `3` | `5` |
| `PAGE_TIMEOUT` | Page load timeout (ms) | `60000` | `30000` |
| `WAIT_TIME` | Wait time after clicking buttons (ms) | `5000` | `3000` |
| `HEADLESS` | Run browser in headless mode | `true` | `false` |
| `USER_AGENT` | Custom user agent string | Chrome default | Custom string |

### Manual Workflow Triggers

The workflow supports manual triggers with optional parameters:

- **Verbose**: Enable detailed logging for debugging
- **Max Retries**: Override the default retry count

## 📊 Output & Monitoring

The tool provides comprehensive logging and statistics:

```
[2024-01-01T12:00:00.000Z] [INFO] Starting GoFile Keep Alive process...
[2024-01-01T12:00:01.000Z] [INFO] Found 3 valid URLs to process
[2024-01-01T12:00:02.000Z] [INFO] Opening https://gofile.io/d/abc123
[2024-01-01T12:00:05.000Z] [INFO] Found 2 download links for https://gofile.io/d/abc123
[2024-01-01T12:00:06.000Z] [INFO] ✓ Ping successful: https://srv-store1.gofile.io/download/abc123/file.zip -> 200 OK

============================================================
SUMMARY
============================================================
Execution time: 45.32s
URLs processed: 3
Download links found: 8
Successful pings: 8
Failed pings: 0
✓ GoFile Keep Alive process completed successfully
```

## ⚡ Performance Optimizations

The GitHub Action has been optimized for faster execution:

- **Reduced Runtime**: Uses Alpine Linux container with pre-installed Chromium (~60% faster)
- **No Browser Downloads**: System Chromium eliminates Playwright installation time
- **Streamlined Workflow**: Tests moved to separate workflow, production runs only essential steps
- **Smaller Timeout**: Reduced overall workflow timeout from 30 to 15 minutes

**Before**: ~5-8 minutes per run  
**After**: ~2-3 minutes per run

## 🔧 Development

### Running Tests

```bash
npm test
```

### Project Structure

```
├── .github/workflows/
│   ├── keep-file-alive.yml     # Optimized production workflow
│   └── test.yml               # Development testing workflow
├── src/
│   └── ping-gofile.js         # Main application logic
├── test/
│   └── test-runner.js         # Test suite
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

### Testing Locally

For testing without triggering actual pings, you can use test URLs:

```bash
export GOFILE_URLS="https://example.com/test1"
export VERBOSE=true
npm start
```

### Local Development Setup

```bash
# Install dependencies (without Playwright browsers)
npm install --ignore-scripts

# For local browser testing, install Playwright browsers manually
# (Only needed if not using Docker or system Chromium)
npx playwright install chromium

# Run tests
npm test

# Validate setup
npm run validate

# Validate optimizations
npm run validate-optimizations
```

## 🛠️ How It Works

1. **URL Parsing**: Parses and validates URLs from the `GOFILE_URLS` environment variable
2. **Browser Launch**: Starts a Chromium browser with optimized settings
3. **Page Navigation**: Visits each GoFile URL and waits for the page to load
4. **Link Detection**: 
   - Monitors network traffic for download URLs
   - Searches for download buttons and links on the page
   - Clicks download buttons to reveal direct download links
5. **Link Pinging**: Sends HEAD requests to download links to keep them alive
6. **Reporting**: Provides detailed statistics and logs

## 🔒 Security & Privacy

- Uses official Playwright browser automation (no third-party tools)
- Only sends HEAD requests to detected download links
- No data is stored or transmitted outside of GitHub Actions
- All communication uses standard HTTPS

## 🚨 Troubleshooting

### Common Issues

**"No URLs found in GOFILE_URLS"**
- Check that the secret is properly set in your repository settings
- Ensure URLs are separated by newlines, not spaces or commas

**"No download links detected"**
- The GoFile page structure may have changed
- Enable verbose logging to see detailed debug information
- Try manually opening the URL to verify it's accessible

**"Ping failed: 403 Forbidden"**
- The download links may have expired despite our efforts
- Try running the action more frequently
- Check if the original GoFile links are still valid

**Workflow timeouts**
- Increase the timeout in the workflow file if processing many URLs
- Consider splitting large URL lists into smaller batches

### Getting Help

1. Enable verbose logging by setting `VERBOSE=true` 
2. Check the workflow logs in the Actions tab
3. Look for specific error messages in the summary section
