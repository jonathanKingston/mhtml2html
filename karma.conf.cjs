module.exports = function (config) {
    config.set({
        frameworks: ['mocha', 'chai'],
        files: [
            'dist/mhtml2html.iife.js',
            'tests/mhtml2html.browser.test.js',
            {
                pattern: 'tests/templates/**/*.mhtml',
                included: false,
                served: true,
                watched: false,
                nocache: true,
            },
        ],
        proxies: {
            '/templates/': '/base/tests/templates/',
        },
        reporters: ['progress'],
        colors: true,
        logLevel: config.LOG_INFO,
        browsers: ['ChromeHeadless'],
        autoWatch: false,
        concurrency: Infinity,
    });
};

