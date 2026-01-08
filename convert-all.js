#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const INPUT_DIR = './pipeline-output';
const OUTPUT_DIR = './.debug/converted-html';

// Get today's date in YYYY-MM-DD format
const TODAY = new Date().toISOString().split('T')[0];

// Recursively find all .mhtml files from today
function findMhtmlFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findMhtmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.mhtml') && entry.name.includes(TODAY)) {
            files.push(fullPath);
        }
    }
    return files;
}

function main() {
    console.log(`Finding .mhtml files in ${INPUT_DIR}...`);
    const mhtmlFiles = findMhtmlFiles(INPUT_DIR);
    console.log(`Found ${mhtmlFiles.length} .mhtml files`);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    let success = 0;
    let failed = 0;

    for (const inputPath of mhtmlFiles) {
        const relativePath = path.relative(INPUT_DIR, inputPath);
        const filename = path.basename(inputPath, '.mhtml') + '.html';
        const outputPath = path.join(OUTPUT_DIR, filename);

        process.stdout.write(`Converting ${relativePath}... `);

        try {
            // Spawn CLI for each file to isolate memory
            execSync(`node index.js -i "${inputPath}" "${outputPath}"`, {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 60000,
                maxBuffer: 50 * 1024 * 1024,
            });
            console.log('OK');
            success++;
        } catch (err) {
            const errMsg = err.stderr ? err.stderr.toString().split('\n')[0] : err.message;
            console.log(`FAILED: ${errMsg}`);
            failed++;
        }
    }

    console.log(`\nDone! ${success} converted, ${failed} failed`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

main();
