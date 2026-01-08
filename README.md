# mhtml2html.js


`mhtml2html` converts `MHTML` files to a single `HTML` file using JavaScript.

[Usage](#usage) | [API](#api) | [Known Limitations](#known-limitations) | [Development](#development)

## Usage

`mhtml2html` is compatible with Node >= 18.

**It has only been tested with MHTML files built and used with Chrome**

### Installation

```sh
# From npm
npm install mhtml2html

# From GitHub (builds automatically)
npm install github:puntowav/mhtml2html
```

### Node.js CLI

```sh
mhtml2html <input.mhtml> <output.html>
mhtml2html --help
```

### Node.js (ESM)

```js
import mhtml2html from 'mhtml2html';
import { JSDOM } from 'jsdom';

const mhtml = '<your MHTML string>';
const htmlDoc = mhtml2html.convert(mhtml, { 
    parseDOM: (html) => new JSDOM(html) 
});
console.log(htmlDoc.serialize());
```

### Node.js (CommonJS)

```js
const mhtml2html = require('mhtml2html');
const { JSDOM } = require('jsdom');

const mhtml = '<your MHTML string>';
const htmlDoc = mhtml2html.convert(mhtml, { 
    parseDOM: (html) => new JSDOM(html) 
});
console.log(htmlDoc.serialize());
```

### Browser

Import as ES module:

```js
import mhtml2html from 'mhtml2html';

const mhtml = '<your MHTML string>';
const html = mhtml2html.convert(mhtml);
console.log(html);
```

Or include via script tag:

```html
<script src="https://unpkg.com/mhtml2html@latest/dist/mhtml2html.iife.js"></script>
<script>
    const html = mhtml2html.convert(mhtmlString);
</script>
```

## API

### parse

```js
mhtml2html.parse(mhtml, { htmlOnly = false, parseDOM = <function> });
```

**Parameters:**
- `mhtml`: An MHTML string
- `options.htmlOnly`: If true, returns only the HTML document without resources
- `options.parseDOM`: Callback that accepts HTML string and returns a window object (defaults to browser's `DOMParser`)

**Returns:** An MHTML parsed object:

```json
{
    "index": "<html-index-url>",
    "media": {
        "<asset-url>": {
            "data": "<resource-string>",
            "id": "<frame-id>",
            "type": "<resource-type>",
            "encoding": "<resource-encoding>",
            "charset": "<charset or null>"
        }
    },
    "frames": {
        "<frame-id>": {
            "data": "<resource-string>",
            "id": "<frame-id>",
            "type": "<resource-type>",
            "encoding": "<resource-encoding>"
        }
    }
}
```

### convert

```js
mhtml2html.convert(mhtml, { convertIframes = false, parseDOM = <function> });
```

**Parameters:**
- `mhtml`: An MHTML string or parsed object
- `options.convertIframes`: Include iframes in converted output (default: false)
- `options.parseDOM`: Callback that accepts HTML string and returns a window object

**Returns:** An HTML window element

## Known Limitations

### MHTML Capture (Chrome limitations)

These are limitations of Chrome's `Page.captureSnapshot` and cannot be fixed in this library:

- **adoptedStyleSheets**: Web components using `new CSSStyleSheet()` and `shadowRoot.adoptedStyleSheets` will have their CSS missing from MHTML
- **Font files**: Fonts referenced in `@font-face` rules are not captured in MHTML

### jsdom Workarounds

These issues are worked around in the code:

- **Declarative Shadow DOM**: jsdom consumes light DOM children incorrectly when parsing `<template shadowrootmode>`. We rename attributes before parsing to preserve content.
- **CSS Custom Properties**: jsdom's CSSOM doesn't support custom properties like `--my-var`. We use `getAttribute`/`setAttribute` instead of `style.cssText` to preserve them.

## Development

### Requirements

- Node.js >= 18
- npm

### Setup

```sh
npm install
```

### Scripts

```sh
npm run build        # Build all formats (ESM, CJS, IIFE)
npm run test         # Run tests (Node + browser)
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run compare      # Screenshot comparison tool
```

### Screenshot Comparison Tool

Compare original pages with their MHTML-converted versions:

```sh
# Test default URLs
npm run compare

# Test single URL
node screenshot-compare.js --url=https://example.com

# Test URLs from file
node screenshot-compare.js --urls=urls.txt
```

Results are saved to `.debug/comparison/` with:
- `original.png` - Screenshot of live page
- `converted.png` - Screenshot after MHTML conversion
- `diff.png` - Visual difference map
- `page.mhtml` - Captured MHTML
- `converted.html` - Converted HTML



## License

Released under the MIT License
