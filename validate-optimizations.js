#!/usr/bin/env node

/**
 * Validation script to ensure workflow optimizations are working correctly
 */

const fs = require('fs');
const path = require('path');

function validateWorkflowOptimizations() {
  console.log('🔍 Validating GitHub Action Optimizations\n');

  const checks = [
    {
      name: 'Production workflow uses Alpine container',
      check: () => {
        const workflow = fs.readFileSync('.github/workflows/keep-file-alive.yml', 'utf8');
        return workflow.includes('node:20-alpine') && workflow.includes('container:');
      }
    },
    {
      name: 'Production workflow does not run tests',
      check: () => {
        const workflow = fs.readFileSync('.github/workflows/keep-file-alive.yml', 'utf8');
        return !workflow.includes('npm test') && !workflow.includes('Run tests');
      }
    },
    {
      name: 'Test workflow exists separately',
      check: () => fs.existsSync('.github/workflows/test.yml')
    },
    {
      name: 'Package.json removed postinstall script',
      check: () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return !pkg.scripts.postinstall;
      }
    },
    {
      name: 'Application supports system Chromium',
      check: () => {
        const source = fs.readFileSync('src/ping-gofile.js', 'utf8');
        return source.includes('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH') && 
               source.includes('executablePath');
      }
    },
    {
      name: 'Workflow timeout reduced',
      check: () => {
        const workflow = fs.readFileSync('.github/workflows/keep-file-alive.yml', 'utf8');
        return workflow.includes('timeout-minutes: 15');
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach(({ name, check }) => {
    try {
      if (check()) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} (Error: ${error.message})`);
      failed++;
    }
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All optimizations validated successfully!');
    console.log('\nExpected improvements:');
    console.log('• ~60% faster execution time');
    console.log('• No Playwright installation overhead');
    console.log('• Cleaner separation of test and production workflows');
    return true;
  } else {
    console.log('❌ Some optimizations failed validation');
    return false;
  }
}

if (require.main === module) {
  const success = validateWorkflowOptimizations();
  process.exit(success ? 0 : 1);
}

module.exports = { validateWorkflowOptimizations };