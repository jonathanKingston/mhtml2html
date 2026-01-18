#!/usr/bin/env node

/**
 * Screenshot Comparison Tool for MHTML Conversion Quality
 *
 * Loads pages from a list, exports to MHTML via CDP, converts back to HTML,
 * then compares screenshots between original and converted versions.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import mhtml2html from './src/mhtml2html.js';
import { JSDOM } from 'jsdom';

const OUTPUT_DIR = './.debug/comparison';
const VIEWPORT = { width: 1280, height: 800 };
const TIMEOUT = 30000;

// Default test URLs - override with --urls=file.txt or --url=https://...
const DEFAULT_URLS = ['https://example.com', 'https://www.w3.org/Style/CSS/Overview.en.html'];

async function ensureDir(dir) {
    await fs.promises.mkdir(dir, { recursive: true });
}

async function captureMHTML(page) {
    const cdp = await page.target().createCDPSession();
    const { data } = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
    return data;
}

async function takeScreenshot(page, filepath) {
    await page.screenshot({ path: filepath, fullPage: false });
}

function convertMHTMLToHTML(mhtmlContent) {
    const dom = mhtml2html.convert(mhtmlContent, {
        convertIframes: true,
        parseDOM: (html) => new JSDOM(html),
    });
    return dom.serialize();
}

async function compareImages(img1Path, img2Path, diffPath) {
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));

    const { width, height } = img1;

    // Handle size mismatches
    if (img2.width !== width || img2.height !== height) {
        return {
            mismatch: true,
            reason: `Size mismatch: ${width}x${height} vs ${img2.width}x${img2.height}`,
            diffPixels: -1,
            diffPercent: -1,
        };
    }

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
        threshold: 0.1,
        includeAA: false,
    });

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    return {
        mismatch: false,
        diffPixels,
        diffPercent: diffPercent.toFixed(2),
        width,
        height,
    };
}

function sanitizeFilename(url) {
    return url
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 100);
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

async function processURL(browser, url, index, results) {
    const safeName = sanitizeFilename(url);
    const pageDir = path.join(OUTPUT_DIR, `${index.toString().padStart(3, '0')}_${safeName}`);
    await ensureDir(pageDir);

    const originalScreenshot = path.join(pageDir, 'original.png');
    const convertedScreenshot = path.join(pageDir, 'converted.png');
    const diffScreenshot = path.join(pageDir, 'diff.png');
    const mhtmlFile = path.join(pageDir, 'page.mhtml');
    const htmlFile = path.join(pageDir, 'converted.html');

    const result = {
        index,
        url,
        safeName,
        success: false,
        error: null,
        comparison: null,
        files: { pageDir, mhtmlFile, htmlFile },
    };

    let page = null;

    try {
        console.log(`[${index}] Loading: ${url}`);

        // Load original page and capture
        page = await browser.newPage();
        await page.setViewport(VIEWPORT);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUT,
        });

        // Wait for fonts, images, and layout to stabilize
        await waitForPageReady(page);

        // Take screenshot of original
        await takeScreenshot(page, originalScreenshot);
        console.log(`[${index}] Original screenshot captured`);

        // Capture MHTML
        const mhtmlContent = await captureMHTML(page);
        await fs.promises.writeFile(mhtmlFile, mhtmlContent);
        console.log(`[${index}] MHTML captured (${(mhtmlContent.length / 1024).toFixed(1)} KB)`);

        await page.close();
        page = null;

        // Convert MHTML to HTML
        const htmlContent = convertMHTMLToHTML(mhtmlContent);
        await fs.promises.writeFile(htmlFile, htmlContent);
        console.log(`[${index}] Converted to HTML (${(htmlContent.length / 1024).toFixed(1)} KB)`);

        // Load converted HTML and screenshot
        page = await browser.newPage();
        await page.setViewport(VIEWPORT);

        // Load as data URI or file URL
        const htmlDataUri = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
        await page.goto(htmlDataUri, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUT,
        });

        // Wait for fonts, images, and layout to stabilize
        await waitForPageReady(page);
        await takeScreenshot(page, convertedScreenshot);
        console.log(`[${index}] Converted screenshot captured`);

        await page.close();
        page = null;

        // Compare screenshots
        const comparison = await compareImages(
            originalScreenshot,
            convertedScreenshot,
            diffScreenshot
        );
        result.comparison = comparison;
        result.success = true;

        if (comparison.mismatch) {
            console.log(`[${index}] ⚠️  ${comparison.reason}`);
        } else {
            const status =
                comparison.diffPercent < 1 ? '✅' : comparison.diffPercent < 5 ? '⚠️' : '❌';
            console.log(
                `[${index}] ${status} Diff: ${comparison.diffPercent}% (${comparison.diffPixels} pixels)`
            );
        }
    } catch (err) {
        result.error = err.message;
        console.log(`[${index}] ❌ Error: ${err.message}`);
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }

    results.push(result);
    return result;
}

async function loadURLList(filepath) {
    const content = await fs.promises.readFile(filepath, 'utf8');
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

function generateReport(results) {
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total: results.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            lowDiff: results.filter((r) => r.success && r.comparison?.diffPercent < 1).length,
            mediumDiff: results.filter(
                (r) => r.success && r.comparison?.diffPercent >= 1 && r.comparison?.diffPercent < 5
            ).length,
            highDiff: results.filter((r) => r.success && r.comparison?.diffPercent >= 5).length,
        },
        results: results.map((r) => ({
            url: r.url,
            success: r.success,
            error: r.error,
            diffPercent: r.comparison?.diffPercent ?? null,
            diffPixels: r.comparison?.diffPixels ?? null,
            directory: r.files?.pageDir,
        })),
    };

    return report;
}

function printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total URLs:      ${report.summary.total}`);
    console.log(`Successful:      ${report.summary.successful}`);
    console.log(`Failed:          ${report.summary.failed}`);
    console.log(`Low diff (<1%):  ${report.summary.lowDiff} ✅`);
    console.log(`Medium (1-5%):   ${report.summary.mediumDiff} ⚠️`);
    console.log(`High (>5%):      ${report.summary.highDiff} ❌`);
    console.log('='.repeat(60));

    // List high-diff pages
    const highDiff = report.results.filter((r) => r.success && r.diffPercent >= 5);
    if (highDiff.length > 0) {
        console.log('\nHigh difference pages:');
        highDiff.forEach((r) => console.log(`  ${r.diffPercent}% - ${r.url}`));
    }

    // List failures
    const failures = report.results.filter((r) => !r.success);
    if (failures.length > 0) {
        console.log('\nFailed pages:');
        failures.forEach((r) => console.log(`  ${r.url}: ${r.error}`));
    }
}

async function main() {
    const args = process.argv.slice(2);
    let urls = [...DEFAULT_URLS];

    // Parse arguments
    for (const arg of args) {
        if (arg.startsWith('--urls=')) {
            const filepath = arg.replace('--urls=', '');
            urls = await loadURLList(filepath);
        } else if (arg.startsWith('--url=')) {
            const singleUrl = arg.replace('--url=', '');
            urls = [singleUrl];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node screenshot-compare.js [options]

Options:
  --urls=<file>   Load URLs from a text file (one URL per line)
  --url=<url>     Test a single URL
  --help, -h      Show this help message

Output:
  Results are saved to ${OUTPUT_DIR}/
  Each URL gets a directory with:
    - original.png    Screenshot of the original page
    - converted.png   Screenshot after MHTML conversion
    - diff.png        Visual difference map
    - page.mhtml      Captured MHTML
    - converted.html  Converted HTML

Examples:
  node screenshot-compare.js
  node screenshot-compare.js --url=https://example.com
  node screenshot-compare.js --urls=urls.txt
`);
            process.exit(0);
        }
    }

    console.log(`Testing ${urls.length} URL(s)...\n`);

    await ensureDir(OUTPUT_DIR);

    const browser = await puppeteer.launch({
        headless: 'new',
        channel: 'chrome', // Use installed Chrome instead of bundled Chromium
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const results = [];

    try {
        for (let i = 0; i < urls.length; i++) {
            await processURL(browser, urls[i], i + 1, results);
        }
    } finally {
        await browser.close();
    }

    // Generate and save report
    const report = generateReport(results);
    const reportPath = path.join(OUTPUT_DIR, 'report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

    printSummary(report);
    console.log(`\nDetailed report: ${reportPath}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
