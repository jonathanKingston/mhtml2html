#!/usr/bin/env node
/**
 * MHTML Generator using Chrome DevTools Protocol
 * 
 * Uses Puppeteer to load each HTML test case and save it as MHTML.
 * Chrome's built-in MHTML serialization captures all resources (CSS, images, fonts).
 * 
 * Usage:
 *   node generate-mhtml.js
 *   node generate-mhtml.js test1-external-css.html  # Single test
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTML_DIR = path.join(__dirname, 'html-sources');
const OUTPUT_DIR = path.join(__dirname, 'mhtml-output');

const TEST_CASES = [
  'test1-external-css.html',
  'test2-images-svg.html',
  'test3-webfonts-typography.html',
  'test4-css-animations.html',
  'test5-iframes.html',
  'test6-complex-layout.html',
  'test7-nested-css-imports.html',
  'test8-custom-elements.html',
  'test9-css-resources.html',
  'test10-js-modules.html',
  'test11-image-loading.html',
  'test12-base64-edge-cases.html',
];

async function generateMHTML(browser, htmlFile) {
  const page = await browser.newPage();
  const htmlPath = path.join(HTML_DIR, htmlFile);
  const outputPath = path.join(OUTPUT_DIR, htmlFile.replace('.html', '.mhtml'));
  
  console.log(`\n📄 Processing: ${htmlFile}`);
  
  await page.setViewport({ width: 1440, height: 900 });
  
  const fileUrl = `file://${htmlPath}`;
  console.log(`   Loading: ${fileUrl}`);
  
  await page.goto(fileUrl, { 
    waitUntil: 'networkidle0',
    timeout: 30000 
  });
  
  // Wait for fonts/animations to settle
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get CDP session and capture as MHTML
  const client = await page.target().createCDPSession();
  console.log(`   Capturing MHTML...`);
  const { data } = await client.send('Page.captureSnapshot', { format: 'mhtml' });
  
  fs.writeFileSync(outputPath, data);
  
  const stats = fs.statSync(outputPath);
  console.log(`   ✅ Saved: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  
  await page.close();
  return outputPath;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const specificTest = process.argv[2];
  const testCases = specificTest ? [specificTest] : TEST_CASES;
  
  console.log('🚀 MHTML Generator');
  console.log('==================');
  console.log(`HTML Source: ${HTML_DIR}`);
  console.log(`Output Dir:  ${OUTPUT_DIR}`);
  console.log(`Test Cases:  ${testCases.length}`);
  
  console.log('\n🌐 Launching Chrome...');
  const browser = await puppeteer.launch({
    headless: 'new',
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
      '--disable-web-security',
    ]
  });
  
  const results = [];
  
  for (const htmlFile of testCases) {
    const htmlPath = path.join(HTML_DIR, htmlFile);
    
    if (!fs.existsSync(htmlPath)) {
      console.log(`\n⚠️  Skipping: ${htmlFile} (file not found)`);
      continue;
    }
    
    const outputPath = await generateMHTML(browser, htmlFile);
    results.push({ input: htmlFile, output: path.basename(outputPath) });
  }
  
  await browser.close();
  
  console.log('\n==================');
  console.log('📊 Summary');
  console.log('==================');
  console.log(`Generated ${results.length} MHTML files:\n`);
  
  for (const { input, output } of results) {
    console.log(`  ${input} → ${output}`);
  }
  
  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
