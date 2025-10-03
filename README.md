# Keep GoFile Alive 

[![Keep Gofile Alive](https://github.com/pcarrasqueira/keep-go-file-alive/actions/workflows/keep-file-alive.yml/badge.svg?branch=main)](https://github.com/pcarrasqueira/keep-go-file-alive/actions/workflows/keep-file-alive.yml)

This repository contains a GitHub Action that periodically downloads sample data from GoFile download links to keep them alive and prevent expiration. The tool uses Playwright to automate browser interactions and intelligently detect download links.

## ✨ Features

- **Automated Link Detection**: Intelligently finds download links on GoFile pages
- **Multi-language Support**: Recognizes download buttons in multiple languages (English, Portuguese, French, Spanish, Italian)
- **Anti-Detection Technology**: Advanced stealth features to avoid automation detection
- **Realistic Headers**: Rotates between authentic browser headers from Chrome, Firefox, Safari, and Edge
- **Human Behavior Simulation**: Mimics human interactions with scrolling and natural timing
- **Robust Error Handling**: Comprehensive retry logic and error recovery
- **Detailed Logging**: Configurable logging levels with comprehensive status reporting
- **Performance Optimized**: Smart resource blocking while maintaining realistic behavior
- **Configurable**: Multiple environment variables for customization

## 🚀 Usage

### Option 1: Fork this Repository

1. Fork this repository to your GitHub account
2. Go to your forked repository's Settings → Secrets and Variables → Actions → Variables tab
3. Create a new repository variable named `GOFILE_URLS`
4. Add your GoFile URLs, one per line:
   ```
   https://gofile.io/d/abc123
   https://gofile.io/d/def456
   https://gofile.io/d/xyz789
   ```
5. The action will run automatically every 3 days at 7:00 AM UTC, or you can trigger it manually

### Option 2: Use in Your Own Repository

1. Copy the `.github/workflows/keep-file-alive.yml` file to your repository
2. Copy the `src/ping-gofile.js` file and `package.json` 
3. Set up the `GOFILE_URLS` variable as described above

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

## 🥷 Stealth Technology

The tool employs sophisticated anti-detection measures:

### Header Management
- **Dynamic User Agents**: Rotates between 16+ real browser user agents (Chrome, Firefox, Safari, Edge)
- **Realistic Headers**: Includes proper Accept-Language, Accept-Encoding, and sec-ch-ua headers
- **Browser-Specific**: Matches headers to the selected user agent for authenticity
- **Session Consistency**: Maintains the same headers throughout a session for natural behavior

### Browser Stealth
- **Automation Hiding**: Removes `navigator.webdriver` property
- **Fingerprint Randomization**: Random viewport sizes from common screen resolutions
- **Efficient Resource Blocking**: Blocks images, stylesheets, fonts, and media for better performance and stability
- **Minimal Overhead**: Streamlined browser setup for maximum stability

### Behavioral Simulation  
- **Human Timing**: Random delays (2-7 seconds) between URL processing
- **Natural Interactions**: Simulates simple scrolling for realistic behavior
- **Realistic Navigation**: Waits for network idle before interacting with elements
- **Organic Clicking**: Small delays before clicking (200-500ms)

## 🔧 Development

### Project Structure

```
├── .github/workflows/
│   └── keep-file-alive.yml     # Optimized production workflow
├── src/
│   ├── ping-gofile.js         # Main application logic
│   ├── headers.js             # Anti-detection headers management
│   └── config.json            # Configuration and stealth settings
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
# (Only needed if not using system Chromium)
npx playwright install chromium

# Validate setup
npm run validate
```

## 🛠️ How It Works

1. **URL Parsing**: Parses and validates URLs from the `GOFILE_URLS` environment variable
2. **Stealth Browser Launch**: Starts a Chromium browser with anti-detection features and realistic configuration
3. **Page Navigation**: Visits each GoFile URL using randomized headers and lightweight navigation (domcontentloaded)
4. **Link Detection** (Enhanced): 
   - Waits 5 seconds for JavaScript-heavy GoFile pages to fully render
   - Monitors network traffic for download URLs
   - Searches for download buttons using 14+ different selectors
   - Checks element visibility before interaction
   - Extracts all GoFile-related links from page content
   - Simulates simple scrolling for realistic behavior
   - Clicks visible download buttons to reveal direct download links
5. **Sample Download**: Downloads the first 1MB of each detected download link using rotating headers to keep them active
6. **Reporting**: Provides detailed statistics and logs

## 🔒 Anti-Detection Features

The tool includes advanced stealth capabilities to avoid automation detection:

- **Dynamic Headers**: Rotates between realistic headers from popular browsers (Chrome, Firefox, Safari, Edge)
- **Browser Fingerprinting**: Randomizes viewport sizes and user agents
- **Human Behavior**: Simulates natural scrolling and interaction timing patterns  
- **Smart Delays**: Adds random delays between operations to mimic human timing
- **Resource Management**: Blocks images, stylesheets, fonts, and media to improve performance and stability
- **Automation Hiding**: Removes webdriver property

## 🔒 Security & Privacy

- Uses official Playwright browser automation with advanced anti-detection features
- Downloads only 1MB samples from detected download links to verify accessibility
- Downloaded data is immediately discarded, nothing is stored permanently
- All communication uses standard HTTPS with realistic browser headers
- Mimics human behavior patterns to avoid triggering security systems

## 🚨 Troubleshooting

### Common Issues

**"No URLs found in GOFILE_URLS"**
- Check that the variable is properly set in your repository settings (Settings → Secrets and Variables → Actions → Variables)
- Ensure URLs are separated by newlines, not spaces or commas

**"No download links detected"**
- The GoFile page structure may have changed
- Enable verbose logging to see detailed debug information
- Try manually opening the URL to verify it's accessible

**"Ping failed: 403 Forbidden"**
- The download links may have expired despite our efforts
- The tool now includes anti-detection features that should reduce this error
- Try running the action more frequently
- Check if the original GoFile links are still valid

**"ERR_INSUFFICIENT_RESOURCES"**
- This error indicates the browser ran out of memory during navigation
- The tool now uses lightweight navigation (domcontentloaded) to reduce memory usage
- Resource blocking is enabled to minimize memory consumption
- If this persists, the GoFile page may be loading too many resources

**Workflow timeouts**
- Increase the timeout in the workflow file if processing many URLs
- The tool now includes random delays for stealth, which may increase runtime
- Consider splitting large URL lists into smaller batches

**"Browser detection issues"**
- The tool includes comprehensive stealth features to avoid detection
- Headers are automatically randomized with each run
- Human behavior simulation helps bypass automated checks
- Enable verbose logging to see which headers are being used

### Getting Help

1. Enable verbose logging by setting `VERBOSE=true` 
2. Check the workflow logs in the Actions tab
3. Look for specific error messages in the summary section
