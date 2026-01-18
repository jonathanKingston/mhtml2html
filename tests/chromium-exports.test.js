/**
 * Chromium Export Tests
 *
 * Tests mhtml2html against real Chromium-generated MHTML files.
 * These test files cover various HTML features and edge cases.
 */

let parseDOM;
let mhtml2html;
let readMHTML;
let chai;

const isNode = typeof process !== 'undefined' && process.versions?.node;

if (isNode) {
    const { JSDOM } = await import('jsdom');
    const mhtml2htmlModule = await import('../src/mhtml2html.js');
    const chaiModule = await import('chai');
    const fs = await import('fs');
    const path = await import('path');

    mhtml2html = mhtml2htmlModule.default;
    parseDOM = (html) => new JSDOM(html);
    chai = chaiModule;

    const FIXTURES_DIR = path.default.join(
        path.default.dirname(new URL(import.meta.url).pathname),
        'fixtures/mhtml-output'
    );

    readMHTML = function (file, callback) {
        const filePath = path.default.join(FIXTURES_DIR, file);
        fs.default.readFile(filePath, 'utf8', function (err, data) {
            if (err) {
                throw err;
            }
            callback(data);
        });
    };
} else {
    mhtml2html = window.mhtml2html;
    chai = window.chai;
    parseDOM = undefined;

    readMHTML = function readMHTML(file, callback) {
        fetch('/fixtures/mhtml-output/' + file)
            .then((response) => response.blob())
            .then((mhtmlBlob) => {
                const reader = new FileReader();
                reader.addEventListener('loadend', function () {
                    callback(this.result);
                });
                reader.readAsText(mhtmlBlob);
            });
    };
}

// Test cases matching the Chromium exports
const TEST_CASES = [
    {
        file: 'test1-external-css.mhtml',
        name: 'External CSS',
        description: 'Tests external stylesheet loading and CSS custom properties',
        checks: (doc, html) => {
            chai.expect(html).to.include('External CSS Loading');
            chai.expect(html).to.include('<style');
        },
    },
    {
        file: 'test2-images-svg.mhtml',
        name: 'Images and SVG',
        description: 'Tests various image formats including SVG',
        checks: (doc, html) => {
            chai.expect(html).to.include('data:image');
        },
    },
    {
        file: 'test3-webfonts-typography.mhtml',
        name: 'Webfonts and Typography',
        description: 'Tests @font-face and typography styles',
        checks: (doc, html) => {
            chai.expect(html).to.include('Typography');
        },
    },
    {
        file: 'test4-css-animations.mhtml',
        name: 'CSS Animations',
        description: 'Tests CSS keyframe animations',
        checks: (doc, html) => {
            chai.expect(html).to.include('Animation');
        },
    },
    {
        file: 'test5-iframes.mhtml',
        name: 'Iframes',
        description: 'Tests iframe content preservation',
        checks: (doc, html) => {
            chai.expect(html).to.include('iframe');
        },
    },
    {
        file: 'test6-complex-layout.mhtml',
        name: 'Complex Layout',
        description: 'Tests complex CSS Grid/Flexbox layouts',
        checks: (doc) => {
            chai.expect(doc.window.document.querySelector('body')).to.not.be.null;
        },
    },
    {
        file: 'test7-nested-css-imports.mhtml',
        name: 'Nested CSS @import',
        description: 'Tests CSS @import chains',
        checks: (doc, html) => {
            chai.expect(html).to.include('<style');
        },
    },
    {
        file: 'test8-custom-elements.mhtml',
        name: 'Custom Elements',
        description: 'Tests web components and custom elements',
        checks: (doc) => {
            chai.expect(doc.window.document.querySelector('body')).to.not.be.null;
        },
    },
    {
        file: 'test9-css-resources.mhtml',
        name: 'CSS Resources',
        description: 'Tests url() references in CSS (backgrounds, cursors)',
        checks: (doc, html) => {
            chai.expect(html).to.include('<style');
        },
    },
    {
        file: 'test10-js-modules.mhtml',
        name: 'JS Modules',
        description: 'Tests JavaScript module loading',
        checks: (doc) => {
            chai.expect(doc.window.document.querySelector('body')).to.not.be.null;
        },
    },
    {
        file: 'test11-image-loading.mhtml',
        name: 'Image Loading',
        description: 'Tests lazy loading, srcset, picture elements',
        checks: (doc, html) => {
            chai.expect(html).to.include('img');
        },
    },
    {
        file: 'test12-base64-edge-cases.mhtml',
        name: 'Base64 Edge Cases',
        description: 'Tests various base64 encoding patterns',
        checks: (doc, html) => {
            chai.expect(html).to.include('data:');
        },
    },
];

describe('Chromium MHTML Export Tests', function () {
    this.timeout(30000);

    describe('Parse Chromium exports', function () {
        for (const testCase of TEST_CASES) {
            it(`Should parse ${testCase.name}`, function (done) {
                readMHTML(testCase.file, (data) => {
                    const doc = mhtml2html.parse(data, { parseDOM });

                    chai.expect(doc).to.be.an('object');
                    chai.expect(doc).to.have.property('index');
                    chai.expect(doc).to.have.property('media');
                    chai.expect(doc).to.have.property('frames');
                    chai.expect(doc.index).to.be.a('string');

                    done();
                });
            });
        }
    });

    describe('Convert Chromium exports', function () {
        for (const testCase of TEST_CASES) {
            it(`Should convert ${testCase.name}`, function (done) {
                readMHTML(testCase.file, (data) => {
                    const doc = mhtml2html.convert(data, { parseDOM, convertIframes: true });

                    chai.expect(doc).to.be.an('object');
                    chai.expect(doc).to.have.property('window');
                    chai.expect(doc.window).to.have.property('document');

                    const html = doc.window.document.documentElement.outerHTML;
                    chai.expect(html).to.be.a('string');
                    chai.expect(html.length).to.be.greaterThan(100);

                    // Run test-specific checks
                    testCase.checks(doc, html);

                    done();
                });
            });
        }
    });

    describe('Round-trip integrity', function () {
        it('Should preserve document structure after conversion', function (done) {
            readMHTML('test1-external-css.mhtml', (data) => {
                const parsed = mhtml2html.parse(data, { parseDOM });
                const converted = mhtml2html.convert(parsed, { parseDOM });

                const document = converted.window.document;

                // Check essential structure is preserved
                chai.expect(document.querySelector('html')).to.not.be.null;
                chai.expect(document.querySelector('head')).to.not.be.null;
                chai.expect(document.querySelector('body')).to.not.be.null;
                chai.expect(document.querySelector('title')).to.not.be.null;

                done();
            });
        });

        it('Should inline external stylesheets', function (done) {
            readMHTML('test1-external-css.mhtml', (data) => {
                const converted = mhtml2html.convert(data, { parseDOM });
                const document = converted.window.document;

                // External <link> should be converted to <style>
                const styles = document.querySelectorAll('style');
                chai.expect(styles.length).to.be.greaterThan(0);

                done();
            });
        });

        it('Should convert images to data URIs', function (done) {
            readMHTML('test2-images-svg.mhtml', (data) => {
                const converted = mhtml2html.convert(data, { parseDOM });
                const html = converted.window.document.documentElement.outerHTML;

                // Check for data URI images
                const hasDataUri = html.includes('data:image');
                chai.expect(hasDataUri).to.be.true;

                done();
            });
        });
    });
});
