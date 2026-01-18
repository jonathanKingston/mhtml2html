/**
 * test.js
 *
 * @Author : Mayank Sindwani
 * @Date   : 2016-09-05
 * @Description : Tests for mhtml2html.
 *
 * The MIT License(MIT)
 * Copyright(c) 2016 Mayank Sindwani
 **/

let parseDOM;
let mhtml2html;
let readMHTML;
let chai;

// Detect environment
const isNode = typeof process !== 'undefined' && process.versions?.node;

if (isNode) {
    // Node.js dependencies (ESM)
    const { JSDOM } = await import('jsdom');
    const mhtml2htmlModule = await import('../src/mhtml2html.js');
    const chaiModule = await import('chai');
    const fs = await import('fs');

    mhtml2html = mhtml2htmlModule.default;
    parseDOM = (html) => new JSDOM(html);
    chai = chaiModule;

    readMHTML = function (file, callback) {
        fs.default.readFile(`tests/templates/${file}`, 'utf8', function (err, data) {
            if (err) {
                throw err;
            }
            callback(data);
        });
    };
} else {
    // Browser dependencies (loaded via karma)
    mhtml2html = window.mhtml2html;
    chai = window.chai;
    parseDOM = undefined; // Use default DOM parser in browser

    readMHTML = function readMHTML(file, callback) {
        // Fetch from the running web server.
        fetch('/templates/' + file)
            .then(function (response) {
                return response.blob();
            })
            .then(function (mhtmlBlob) {
                // Read the mhtml template as a string.
                var reader = new FileReader();
                reader.addEventListener('loadend', function () {
                    callback(this.result);
                });
                reader.readAsText(mhtmlBlob);
            });
    };
}

describe('Test parsing MHTML', function () {
    it('Should parse valid MHTML', function (done) {
        readMHTML('portfolio.mhtml', (data) => {
            let doc;

            doc = mhtml2html.parse(data, { parseDOM });
            chai.expect(doc).to.be.a('object');
            chai.expect(doc).to.have.property('index', 'http://msindwan.bitbucket.org/');
            chai.expect(doc).to.have.property('media');

            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/ext/font-awesome/fonts/fontawesome-webfont.woff?v=4.2.0'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/ext/font-awesome/fonts/fontawesome-webfont.woff?v=4.2.0'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/ext/font-awesome/css/font-awesome.min.css'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/ext/bootstrap/bootstrap.min.css'
            );
            chai.expect(doc.media).to.have.property(
                'https://fonts.gstatic.com/s/roboto/v15/2tsd397wLxj96qwHyNIkxPesZW2xOQ-xsNqO47m55DA.woff2'
            );
            chai.expect(doc.media).to.have.property(
                'https://fonts.gstatic.com/s/roboto/v15/CWB0XYA8bzo0kSThX0UTuA.woff2'
            );
            chai.expect(doc.media).to.have.property(
                'https://fonts.googleapis.com/css?family=Roboto:400,100'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/images/html5.png'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/images/flux.png'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/images/node.png'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/images/mongodb.png'
            );
            chai.expect(doc.media).to.have.property(
                'http://msindwan.bitbucket.org/images/react.png'
            );
            chai.expect(doc.media).to.have.property('http://msindwan.bitbucket.org/css/design.css');

            done();
        });
    });

    it('Should handle MHTML with missing headers gracefully', function (done) {
        readMHTML('missing_headers.mhtml', (data) => {
            // With soft assertions, this should now warn but not throw
            const doc = mhtml2html.parse(data, { parseDOM });
            chai.expect(doc).to.be.a('object');
            done();
        });
    });

    it('Should handle MHTML with missing boundary header gracefully', function (done) {
        readMHTML('missing_boundary_header.mhtml', (data) => {
            // With soft assertions, this should now warn but return partial result
            const doc = mhtml2html.parse(data, { parseDOM });
            chai.expect(doc).to.be.a('object');
            done();
        });
    });

    it('Should handle MHTML with missing asset boundary gracefully', function (done) {
        readMHTML('missing_boundary.mhtml', (data) => {
            // With soft assertions, this should now warn but continue
            const doc = mhtml2html.parse(data, { parseDOM });
            chai.expect(doc).to.be.a('object');
            done();
        });
    });

    it('Should handle MHTML with unexpected EOF gracefully', function (done) {
        readMHTML('unexpected_eof.mhtml', (data) => {
            // With soft assertions, this should now handle EOF gracefully
            const doc = mhtml2html.parse(data, { parseDOM });
            chai.expect(doc).to.be.a('object');
            done();
        });
    });
});

describe('Test converting MHTML to HTML', function () {
    it('Should convert valid MHTML from string', function (done) {
        this.timeout(10000);

        readMHTML('portfolio.mhtml', (data) => {
            let doc;

            doc = mhtml2html.convert(data, { parseDOM });
            chai.expect(typeof doc).to.equal('object');
            chai.expect(doc).to.have.property('window');
            done();
        });
    });

    it('Should convert valid MHTML from parsed object', function (done) {
        this.timeout(10000);

        readMHTML('portfolio.mhtml', (data) => {
            let doc;

            doc = mhtml2html.parse(data, { parseDOM });
            doc = mhtml2html.convert(doc, { parseDOM });

            chai.expect(doc).to.have.property('window');
            done();
        });
    });

    it('Should convert valid MHTML with iframes disabled', function (done) {
        this.timeout(10000);

        readMHTML('iframes.mhtml', (data) => {
            const doc = mhtml2html.convert(data, { parseDOM, convertIframes: false });
            const iframe = doc.window.document.querySelector('iframe.result');
            chai.expect(iframe.src.startsWith('cid')).to.be.true;
            done();
        });
    });

    it('Should convert valid MHTML with iframes enabled', function (done) {
        this.timeout(30000);

        readMHTML('iframes.mhtml', (data) => {
            const doc = mhtml2html.convert(data, { parseDOM, convertIframes: true });
            const iframe = doc.window.document.querySelector('iframe.result');
            chai.expect(iframe.src.startsWith('data:text/html;charset=utf-8,')).to.be.true;
            done();
        });
    });

    it('Should raise an exception for invalid MHTML object', function (done) {
        chai.expect(() => {
            mhtml2html.convert({}, { parseDOM });
        }).to.throw('MHTML error: invalid frames');
        done();
    });
});
