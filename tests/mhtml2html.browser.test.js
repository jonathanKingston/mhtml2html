/**
 * Browser tests for mhtml2html
 *
 * @Author : Mayank Sindwani
 * @Date   : 2016-09-05
 * @Description : Browser tests for mhtml2html (loaded via karma).
 *
 * The MIT License(MIT)
 * Copyright(c) 2016 Mayank Sindwani
 **/

/* global mhtml2html, chai */

function readMHTML(file, callback) {
    fetch('/templates/' + file)
        .then(function (response) {
            return response.blob();
        })
        .then(function (mhtmlBlob) {
            var reader = new FileReader();
            reader.addEventListener('loadend', function () {
                callback(this.result);
            });
            reader.readAsText(mhtmlBlob);
        });
}

describe('Browser: Test parsing MHTML', function () {
    it('Should parse valid MHTML', function (done) {
        readMHTML('portfolio.mhtml', function (data) {
            var doc = mhtml2html.parse(data);
            chai.expect(doc).to.be.a('object');
            chai.expect(doc).to.have.property('index', 'http://msindwan.bitbucket.org/');
            chai.expect(doc).to.have.property('media');
            done();
        });
    });

    it('Should handle MHTML with missing headers gracefully', function (done) {
        readMHTML('missing_headers.mhtml', function (data) {
            var doc = mhtml2html.parse(data);
            chai.expect(doc).to.be.a('object');
            done();
        });
    });
});

describe('Browser: Test converting MHTML to HTML', function () {
    it('Should convert valid MHTML from string', function (done) {
        this.timeout(10000);

        readMHTML('portfolio.mhtml', function (data) {
            var doc = mhtml2html.convert(data);
            chai.expect(typeof doc).to.equal('object');
            chai.expect(doc).to.have.property('window');
            done();
        });
    });

    it('Should convert valid MHTML from parsed object', function (done) {
        this.timeout(10000);

        readMHTML('portfolio.mhtml', function (data) {
            var doc = mhtml2html.parse(data);
            doc = mhtml2html.convert(doc);
            chai.expect(doc).to.have.property('window');
            done();
        });
    });

    it('Should convert valid MHTML with iframes disabled', function (done) {
        this.timeout(10000);

        readMHTML('iframes.mhtml', function (data) {
            var doc = mhtml2html.convert(data, { convertIframes: false });
            var iframe = doc.window.document.querySelector('iframe.result');
            chai.expect(iframe.src.startsWith('cid')).to.be.true;
            done();
        });
    });

    it('Should convert valid MHTML with iframes enabled', function (done) {
        this.timeout(10000);

        readMHTML('iframes.mhtml', function (data) {
            var doc = mhtml2html.convert(data, { convertIframes: true });
            var iframe = doc.window.document.querySelector('iframe.result');
            chai.expect(iframe.src.startsWith('data:text/html;charset=utf-8,')).to.be.true;
            done();
        });
    });

    it('Should raise an exception for invalid MHTML object', function (done) {
        chai.expect(function () {
            mhtml2html.convert({});
        }).to.throw('MHTML error: invalid frames');
        done();
    });
});
