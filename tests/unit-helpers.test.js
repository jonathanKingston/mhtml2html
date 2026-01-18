/**
 * Unit tests for helper functions in mhtml2html
 *
 * Tests the internal helper functions for:
 * - Charset extraction and decoding
 * - Line ending normalization
 * - MIME type parsing
 * - URL resolution strategies
 */

let mhtml2html;
let chai;
let parseDOM;

const isNode = typeof process !== 'undefined' && process.versions?.node;

if (isNode) {
    const { JSDOM } = await import('jsdom');
    const mhtml2htmlModule = await import('../src/mhtml2html.js');
    const chaiModule = await import('chai');

    mhtml2html = mhtml2htmlModule.default;
    parseDOM = (html) => new JSDOM(html);
    chai = chaiModule;
}

describe('Line Ending Normalization', function () {
    it('Should handle CRLF line endings', function (done) {
        // MHTML with Windows-style CRLF line endings
        const mhtmlWithCRLF =
            'MIME-Version: 1.0\r\n' +
            'Content-Type: multipart/related; boundary="----boundary"\r\n' +
            '\r\n' +
            '------boundary\r\n' +
            'Content-Type: text/html\r\n' +
            'Content-Location: http://example.com/\r\n' +
            '\r\n' +
            '<!DOCTYPE html><html><body>CRLF Test</body></html>\r\n' +
            '------boundary--\r\n';

        const doc = mhtml2html.parse(mhtmlWithCRLF, { parseDOM });
        chai.expect(doc).to.be.an('object');
        chai.expect(doc.index).to.equal('http://example.com/');
        chai.expect(doc.media['http://example.com/'].data).to.include('CRLF Test');
        done();
    });

    it('Should handle mixed line endings', function (done) {
        // MHTML with mixed LF and CRLF
        const mhtmlMixed =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\r\n' +
            '\n' +
            '------boundary\r\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/mixed\r\n' +
            '\n' +
            '<!DOCTYPE html><html><body>Mixed Line Endings</body></html>\n' +
            '------boundary--\n';

        const doc = mhtml2html.parse(mhtmlMixed, { parseDOM });
        chai.expect(doc).to.be.an('object');
        chai.expect(doc.index).to.equal('http://example.com/mixed');
        done();
    });
});

describe('Charset Handling', function () {
    it('Should parse Content-Type with charset', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html; charset=utf-8\n' +
            'Content-Location: http://example.com/\n' +
            '\n' +
            '<!DOCTYPE html><html><body>UTF-8 Content</body></html>\n' +
            '------boundary--\n';

        const doc = mhtml2html.parse(mhtml, { parseDOM });
        chai.expect(doc).to.be.an('object');
        chai.expect(doc.media['http://example.com/'].charset).to.equal('utf-8');
        done();
    });

    it('Should extract charset from complex Content-Type', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html; charset="windows-1252"\n' +
            'Content-Location: http://example.com/\n' +
            '\n' +
            '<!DOCTYPE html><html><body>Windows charset</body></html>\n' +
            '------boundary--\n';

        const doc = mhtml2html.parse(mhtml, { parseDOM });
        chai.expect(doc.media['http://example.com/'].charset).to.equal('windows-1252');
        done();
    });

    it('Should handle Content-Type without charset', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/\n' +
            '\n' +
            '<!DOCTYPE html><html><body>No charset</body></html>\n' +
            '------boundary--\n';

        const doc = mhtml2html.parse(mhtml, { parseDOM });
        chai.expect(doc.media['http://example.com/'].charset).to.be.null;
        done();
    });
});

describe('MIME Type Extraction', function () {
    it('Should extract MIME type without charset', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/css; charset=utf-8\n' +
            'Content-Location: http://example.com/style.css\n' +
            '\n' +
            'body { color: red; }\n' +
            '------boundary\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/\n' +
            '\n' +
            '<!DOCTYPE html><html><head><link rel="stylesheet" href="http://example.com/style.css"></head><body></body></html>\n' +
            '------boundary--\n';

        const doc = mhtml2html.parse(mhtml, { parseDOM });
        // MIME type should be stored without charset suffix
        chai.expect(doc.media['http://example.com/style.css'].type).to.equal('text/css');
        done();
    });
});

describe('URL Resolution in CSS', function () {
    it('Should resolve relative URLs in CSS', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/page/\n' +
            '\n' +
            '<!DOCTYPE html><html><head><style>body { background: url(../images/bg.png); }</style></head><body></body></html>\n' +
            '------boundary\n' +
            'Content-Type: image/png\n' +
            'Content-Transfer-Encoding: base64\n' +
            'Content-Location: http://example.com/images/bg.png\n' +
            '\n' +
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\n' +
            '------boundary--\n';

        const doc = mhtml2html.convert(mhtml, { parseDOM });
        const html = doc.window.document.documentElement.outerHTML;
        // The relative URL should be resolved and converted to data URI
        chai.expect(html).to.include('data:image/png;base64');
        done();
    });

    it('Should resolve root-relative URLs in CSS', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/deep/nested/page/\n' +
            '\n' +
            '<!DOCTYPE html><html><head><style>body { background: url(/images/root-bg.png); }</style></head><body></body></html>\n' +
            '------boundary\n' +
            'Content-Type: image/png\n' +
            'Content-Transfer-Encoding: base64\n' +
            'Content-Location: http://example.com/images/root-bg.png\n' +
            '\n' +
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==\n' +
            '------boundary--\n';

        const doc = mhtml2html.convert(mhtml, { parseDOM });
        const html = doc.window.document.documentElement.outerHTML;
        chai.expect(html).to.include('data:image/png;base64');
        done();
    });
});

describe('Base64 CSS Handling', function () {
    it('Should decode base64-encoded CSS before embedding', function (done) {
        // "body { color: blue; }" encoded in base64
        const cssBase64 = Buffer.from('body { color: blue; }').toString('base64');

        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/\n' +
            '\n' +
            '<!DOCTYPE html><html><head><link rel="stylesheet" href="http://example.com/style.css"></head><body></body></html>\n' +
            '------boundary\n' +
            'Content-Type: text/css\n' +
            'Content-Transfer-Encoding: base64\n' +
            'Content-Location: http://example.com/style.css\n' +
            '\n' +
            cssBase64 +
            '\n' +
            '------boundary--\n';

        const doc = mhtml2html.convert(mhtml, { parseDOM });
        const html = doc.window.document.documentElement.outerHTML;
        // The base64 CSS should be decoded and embedded as inline style
        chai.expect(html).to.include('color: blue');
        done();
    });
});

describe('CSS Custom Properties Preservation', function () {
    it('Should preserve CSS custom properties in inline styles', function (done) {
        const mhtml =
            'MIME-Version: 1.0\n' +
            'Content-Type: multipart/related; boundary="----boundary"\n' +
            '\n' +
            '------boundary\n' +
            'Content-Type: text/html\n' +
            'Content-Location: http://example.com/\n' +
            '\n' +
            '<!DOCTYPE html><html><body><div style="--custom-prop: blue; color: var(--custom-prop);">Custom Props</div></body></html>\n' +
            '------boundary--\n';

        const doc = mhtml2html.convert(mhtml, { parseDOM });
        const div = doc.window.document.querySelector('div');
        const style = div.getAttribute('style');
        // CSS custom properties should be preserved
        chai.expect(style).to.include('--custom-prop');
        done();
    });
});
