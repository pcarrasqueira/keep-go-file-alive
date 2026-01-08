#!/usr/bin/env node

/**
 * Validation script to check if the environment is properly configured
 */

const fs = require('fs');
const path = require('path');

class SetupValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = 0;
    this.total = 0;
  }

  log(message, type = 'info') {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    console.log(`${icons[type] || icons.info} ${message}`);
  }

  check(description, testFn) {
    this.total++;
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        this.log(`${description}`, 'success');
        this.passed++;
      } else {
        this.log(`${description}: ${result}`, 'error');
        this.errors.push(description);
      }
    } catch (error) {
      this.log(`${description}: ${error.message}`, 'error');
      this.errors.push(description);
    }
  }

  warn(message) {
    this.log(message, 'warning');
    this.warnings.push(message);
  }

  async validate() {
    console.log('🔍 Validating Buzzheavier Keep Alive Setup');
    console.log('=====================================\n');

    // Check Node.js version
    this.check('Node.js version >= 18', () => {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      if (majorVersion < 18) {
        return `Found ${version}, but >=18.0.0 is required`;
      }
    });

    // Check package.json exists
    this.check('package.json exists', () => {
      if (!fs.existsSync('package.json')) {
        return 'package.json not found';
      }
    });

    // Check main script exists
    this.check('Main script exists', () => {
      if (!fs.existsSync('src/ping-buzzheavier.js')) {
        return 'src/ping-buzzheavier.js not found';
      }
    });

    // Check dependencies
    this.check('Dependencies installed', () => {
      if (!fs.existsSync('node_modules')) {
        return 'node_modules not found. Run: npm install';
      }
      
      if (!fs.existsSync('node_modules/playwright')) {
        return 'Playwright not installed. Run: npm install';
      }
    });

    // Check workflow file
    this.check('GitHub Actions workflow exists', () => {
      if (!fs.existsSync('.github/workflows/keep-file-alive.yml')) {
        return 'Workflow file not found';
      }
    });

    // Check .gitignore
    this.check('.gitignore exists', () => {
      if (!fs.existsSync('.gitignore')) {
        return '.gitignore not found';
      }
    });

    // Check BUZZHEAVIER_URLS environment variable
    const buzzheavierUrls = process.env.BUZZHEAVIER_URLS;
    if (buzzheavierUrls) {
      this.check('BUZZHEAVIER_URLS environment variable format', () => {
        const urls = buzzheavierUrls.split(/\r?\n/).filter(Boolean);
        if (urls.length === 0) {
          return 'No URLs found in BUZZHEAVIER_URLS';
        }
        
        for (const url of urls) {
          try {
            new URL(url.trim());
          } catch (e) {
            return `Invalid URL format: ${url}`;
          }
        }
        
        this.log(`Found ${urls.length} URL(s) in BUZZHEAVIER_URLS`, 'info');
      });
    } else {
      this.warn('BUZZHEAVIER_URLS environment variable not set (this is normal for setup validation)');
    }

    // Check if running in GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      this.log('Running in GitHub Actions environment', 'info');
      
      this.check('GitHub Actions variables available', () => {
        if (!process.env.BUZZHEAVIER_URLS) {
          return 'BUZZHEAVIER_URLS variable not available. Check repository variables.';
        }
      });
    }

    // Try to load the main module
    this.check('Main module can be loaded', () => {
      try {
        require('./src/ping-buzzheavier.js');
      } catch (error) {
        return `Module loading failed: ${error.message}`;
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    
    if (this.errors.length === 0) {
      this.log(`All ${this.passed}/${this.total} checks passed!`, 'success');
      if (this.warnings.length > 0) {
        console.log(`\n${this.warnings.length} warning(s):`);
        this.warnings.forEach(warning => console.log(`  • ${warning}`));
      }
      console.log('\n🎉 Your setup looks good! You can now run the tool.');
    } else {
      this.log(`${this.passed}/${this.total} checks passed`, 'error');
      console.log(`\n${this.errors.length} error(s) found:`);
      this.errors.forEach(error => console.log(`  • ${error}`));
      console.log('\n🔧 Please fix the errors above before using the tool.');
    }

    if (!process.env.BUZZHEAVIER_URLS && !process.env.GITHUB_ACTIONS) {
      console.log('\n💡 Next steps:');
      console.log('1. Set BUZZHEAVIER_URLS environment variable with your URLs');
      console.log('2. Run: npm start');
      console.log('3. Or set up GitHub repository variables for automated runs');
    }

    return this.errors.length === 0;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new SetupValidator();
  validator.validate()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = SetupValidator;