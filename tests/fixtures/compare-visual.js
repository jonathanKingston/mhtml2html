#!/usr/bin/env node
/**
 * Visual Comparison Script
 *
 * Compares original HTML vs mhtml2html-converted output using screenshots.
 * This validates that the MHTML → HTML conversion preserves visual fidelity.
 *
 * Usage:
 *   node compare-visual.js
 *
 * Output:
 *   - screenshots/html/     - Original HTML screenshots
 *   - screenshots/converted/ - mhtml2html output screenshots
 *   - screenshots/diff/     - Difference images
 *   - comparison-report.json
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import mhtml2html
const mhtml2htmlPath = path.join(__dirname, '../../src/mhtml2html.js');

const HTML_DIR = path.join(__dirname, 'html-sources');
const MHTML_DIR = path.join(__dirname, 'mhtml-output');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const CONVERTED_DIR = path.join(__dirname, 'converted-output');

const TEST_CASES = [
    'test1-external-css',
    'test2-images-svg',
    'test3-webfonts-typography',
    'test4-css-animations',
    'test5-iframes',
    'test6-complex-layout',
    'test7-nested-css-imports',
    'test8-custom-elements',
    'test9-css-resources',
    'test10-js-modules',
    'test11-image-loading',
    'test12-base64-edge-cases',
];

const VIEWPORT = { width: 1440, height: 900 };

async function ensureDirectories() {
    const dirs = [
        path.join(SCREENSHOTS_DIR, 'html'),
        path.join(SCREENSHOTS_DIR, 'converted'),
        path.join(SCREENSHOTS_DIR, 'diff'),
        CONVERTED_DIR,
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

async function convertMhtmlToHtml(mhtmlPath, outputPath) {
    // Dynamic import for ESM
    const { default: mhtml2html } = await import(mhtml2htmlPath);
    const { JSDOM } = await import('jsdom');

    const mhtmlContent = fs.readFileSync(mhtmlPath, 'utf8');
    const parseDOM = (html) => new JSDOM(html);

    const result = mhtml2html.convert(mhtmlContent, { parseDOM, convertIframes: true });
    const html = result.window.document.documentElement.outerHTML;

    fs.writeFileSync(outputPath, `<!DOCTYPE html>\n${html}`);
    return outputPath;
}

/**
 * Wait for the page to be fully ready (fonts loaded, images loaded, layout stable).
 * Uses proper browser APIs instead of arbitrary setTimeout.
 */
async function waitForPageReady(page) {
    await page.evaluate(async () => {
        // Wait for all fonts to load
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        // Wait for images to load
        const images = Array.from(document.images);
        await Promise.all(
            images
                .filter((img) => !img.complete)
                .map(
                    (img) =>
                        new Promise((resolve) => {
                            img.onload = resolve;
                            img.onerror = resolve;
                        })
                )
        );

        // Wait for next animation frame to ensure layout is stable
        await new Promise((resolve) => requestAnimationFrame(resolve));
    });
}

async function captureScreenshot(page, url, outputPath) {
    await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
    });

    // Wait for fonts, images, and layout to stabilize
    await waitForPageReady(page);

    await page.screenshot({
        path: outputPath,
        fullPage: true,
    });

    return outputPath;
}

function compareImages(img1Path, img2Path, diffPath) {
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));

    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    const canvas1 = new PNG({ width, height });
    const canvas2 = new PNG({ width, height });
    const diff = new PNG({ width, height });

    // Fill with white background
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (width * y + x) << 2;
            canvas1.data[idx] = canvas1.data[idx + 1] = canvas1.data[idx + 2] = 255;
            canvas1.data[idx + 3] = 255;
            canvas2.data[idx] = canvas2.data[idx + 1] = canvas2.data[idx + 2] = 255;
            canvas2.data[idx + 3] = 255;
        }
    }

    PNG.bitblt(img1, canvas1, 0, 0, img1.width, img1.height, 0, 0);
    PNG.bitblt(img2, canvas2, 0, 0, img2.width, img2.height, 0, 0);

    const mismatchedPixels = pixelmatch(canvas1.data, canvas2.data, diff.data, width, height, {
        threshold: 0.1,
        includeAA: false,
        alpha: 0.5,
    });

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const totalPixels = width * height;
    const matchPercentage = (((totalPixels - mismatchedPixels) / totalPixels) * 100).toFixed(2);

    return {
        width,
        height,
        totalPixels,
        mismatchedPixels,
        matchPercentage: parseFloat(matchPercentage),
        sizeDifference: img1.width !== img2.width || img1.height !== img2.height,
    };
}

async function main() {
    console.log('🔍 mhtml2html Visual Comparison');
    console.log('================================\n');

    await ensureDirectories();

    console.log('🌐 Launching Chrome...\n');
    const browser = await puppeteer.launch({
        headless: 'new',
        channel: 'chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--allow-file-access-from-files',
            '--disable-web-security',
        ],
    });

    const results = [];

    for (const testName of TEST_CASES) {
        const htmlPath = path.join(HTML_DIR, `${testName}.html`);
        const mhtmlPath = path.join(MHTML_DIR, `${testName}.mhtml`);

        if (!fs.existsSync(htmlPath)) {
            console.log(`⚠️  Skipping ${testName}: HTML not found`);
            continue;
        }

        if (!fs.existsSync(mhtmlPath)) {
            console.log(`⚠️  Skipping ${testName}: MHTML not found`);
            continue;
        }

        console.log(`📸 ${testName}`);

        // Convert MHTML to HTML using mhtml2html
        const convertedPath = path.join(CONVERTED_DIR, `${testName}.html`);
        console.log(`   Converting MHTML → HTML...`);
        try {
            await convertMhtmlToHtml(mhtmlPath, convertedPath);
        } catch (err) {
            console.log(`   ❌ Conversion failed: ${err.message}`);
            results.push({
                test: testName,
                error: err.message,
                matchPercentage: 0,
            });
            continue;
        }

        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);

        // Screenshot original HTML
        const htmlScreenshot = path.join(SCREENSHOTS_DIR, 'html', `${testName}.png`);
        console.log(`   HTML → ${path.basename(htmlScreenshot)}`);
        await captureScreenshot(page, `file://${htmlPath}`, htmlScreenshot);

        // Screenshot converted HTML
        const convertedScreenshot = path.join(SCREENSHOTS_DIR, 'converted', `${testName}.png`);
        console.log(`   Converted → ${path.basename(convertedScreenshot)}`);
        await captureScreenshot(page, `file://${convertedPath}`, convertedScreenshot);

        await page.close();

        // Compare
        const diffPath = path.join(SCREENSHOTS_DIR, 'diff', `${testName}-diff.png`);
        const comparison = compareImages(htmlScreenshot, convertedScreenshot, diffPath);

        const status =
            comparison.matchPercentage >= 99
                ? '✅'
                : comparison.matchPercentage >= 95
                  ? '⚠️'
                  : '❌';

        console.log(
            `   ${status} Match: ${comparison.matchPercentage}% (${comparison.mismatchedPixels.toLocaleString()} pixels differ)\n`
        );

        results.push({
            test: testName,
            ...comparison,
            files: {
                html: `html/${testName}.png`,
                converted: `converted/${testName}.png`,
                diff: `diff/${testName}-diff.png`,
            },
        });
    }

    await browser.close();

    // Generate report
    const report = {
        timestamp: new Date().toISOString(),
        viewport: VIEWPORT,
        results,
        summary: {
            total: results.length,
            passed: results.filter((r) => r.matchPercentage >= 99).length,
            warnings: results.filter((r) => r.matchPercentage >= 95 && r.matchPercentage < 99)
                .length,
            failed: results.filter((r) => r.matchPercentage < 95).length,
            errors: results.filter((r) => r.error).length,
            averageMatch:
                results.filter((r) => !r.error).length > 0
                    ? (
                          results
                              .filter((r) => !r.error)
                              .reduce((sum, r) => sum + r.matchPercentage, 0) /
                          results.filter((r) => !r.error).length
                      ).toFixed(2)
                    : 0,
        },
    };

    const reportPath = path.join(__dirname, 'comparison-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('================================');
    console.log('📊 Summary');
    console.log('================================');
    console.log(`Total tests:    ${report.summary.total}`);
    console.log(`✅ Passed:      ${report.summary.passed} (≥99% match)`);
    console.log(`⚠️  Warnings:    ${report.summary.warnings} (95-99% match)`);
    console.log(`❌ Failed:      ${report.summary.failed} (<95% match)`);
    console.log(`💥 Errors:      ${report.summary.errors}`);
    console.log(`Average match:  ${report.summary.averageMatch}%`);
    console.log(`\n📄 Report: ${reportPath}`);

    await generateHtmlReport(report);

    console.log('\n✨ Done!');

    if (report.summary.failed > 0 || report.summary.errors > 0) {
        process.exit(1);
    }
}

async function generateHtmlReport(report) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mhtml2html Conversion Report</title>
  <style>
    :root { --bg: #0a0a0a; --surface: #141414; --border: #262626; --text: #fafafa; --muted: #737373; --success: #22c55e; --warning: #f59e0b; --danger: #ef4444; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .timestamp { color: var(--muted); margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 3rem; }
    .summary-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; text-align: center; }
    .summary-card .value { font-size: 2.5rem; font-weight: 700; }
    .summary-card .label { color: var(--muted); font-size: 0.875rem; }
    .summary-card.passed .value { color: var(--success); }
    .summary-card.warning .value { color: var(--warning); }
    .summary-card.failed .value { color: var(--danger); }
    .test-results { display: flex; flex-direction: column; gap: 2rem; }
    .test-card { background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; }
    .test-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); }
    .test-name { font-weight: 600; font-size: 1.125rem; }
    .test-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .test-badge.passed { background: rgba(34, 197, 94, 0.15); color: var(--success); }
    .test-badge.warning { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
    .test-badge.failed { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
    .test-images { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1px; background: var(--border); }
    .test-image { background: var(--bg); padding: 1rem; }
    .test-image h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.75rem; }
    .test-image img { width: 100%; height: auto; border-radius: 0.5rem; border: 1px solid var(--border); }
    .test-stats { display: flex; gap: 2rem; padding: 1rem 1.5rem; background: var(--bg); font-size: 0.875rem; color: var(--muted); }
    .test-stats strong { color: var(--text); }
    .error-message { padding: 1rem 1.5rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); }
  </style>
</head>
<body>
  <div class="container">
    <h1>mhtml2html Conversion Report</h1>
    <p class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    
    <div class="summary">
      <div class="summary-card">
        <div class="value">${report.summary.total}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="summary-card passed">
        <div class="value">${report.summary.passed}</div>
        <div class="label">Passed (≥99%)</div>
      </div>
      <div class="summary-card warning">
        <div class="value">${report.summary.warnings}</div>
        <div class="label">Warnings (95-99%)</div>
      </div>
      <div class="summary-card failed">
        <div class="value">${report.summary.failed}</div>
        <div class="label">Failed (&lt;95%)</div>
      </div>
      <div class="summary-card failed">
        <div class="value">${report.summary.errors}</div>
        <div class="label">Errors</div>
      </div>
    </div>
    
    <div class="test-results">
      ${report.results
          .map((r) => {
              if (r.error) {
                  return `
          <div class="test-card">
            <div class="test-header">
              <span class="test-name">${r.test}</span>
              <span class="test-badge failed">Error</span>
            </div>
            <div class="error-message">${r.error}</div>
          </div>`;
              }
              const status =
                  r.matchPercentage >= 99
                      ? 'passed'
                      : r.matchPercentage >= 95
                        ? 'warning'
                        : 'failed';
              return `
        <div class="test-card">
          <div class="test-header">
            <span class="test-name">${r.test}</span>
            <span class="test-badge ${status}">${r.matchPercentage}% match</span>
          </div>
          <div class="test-images">
            <div class="test-image">
              <h3>Original HTML</h3>
              <img src="screenshots/${r.files.html}" alt="HTML screenshot">
            </div>
            <div class="test-image">
              <h3>mhtml2html Output</h3>
              <img src="screenshots/${r.files.converted}" alt="Converted screenshot">
            </div>
            <div class="test-image">
              <h3>Difference</h3>
              <img src="screenshots/${r.files.diff}" alt="Diff image">
            </div>
          </div>
          <div class="test-stats">
            <span><strong>${r.mismatchedPixels.toLocaleString()}</strong> pixels differ</span>
            <span>Dimensions: <strong>${r.width}×${r.height}</strong></span>
            ${r.sizeDifference ? '<span style="color: var(--warning)">⚠️ Size mismatch</span>' : ''}
          </div>
        </div>`;
          })
          .join('')}
    </div>
  </div>
</body>
</html>`;

    const reportPath = path.join(__dirname, 'comparison-report.html');
    fs.writeFileSync(reportPath, html);
    console.log(`🌐 HTML Report: ${reportPath}`);
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
