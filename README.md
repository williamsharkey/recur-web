# recur-web

**A recursive browser inside a browser** - Browser automation IDE for [FunctionServer OS](https://functionserver.com)

Think Puppeteer, but running entirely in your browser. Write scripts, record interactions, and automate web testing without any external dependencies.

## Features

- **Puppeteer-like API** - Familiar `page.goto()`, `page.click()`, `page.$eval()` syntax
- **Action Recording** - Click "Record" and interact with pages to generate automation scripts
- **Live Inspector** - Real-time DOM tree visualization
- **Built-in Examples** - Web scraping, form automation, assertion testing templates
- **Cross-Origin Support** - Fetches external pages through CORS proxies
- **Zero Dependencies** - Runs entirely in the browser

## Quick Start

### In FunctionServer OS

1. Visit [functionserver.com](https://functionserver.com)
2. Open Programs > recur-web
3. Enter a URL and click "Go"
4. Write scripts or click "Record" to capture interactions
5. Press Cmd/Ctrl+Enter to run

### Standalone

```html
<script src="https://functionserver.com/fs.min.js"></script>
<script src="recur-web.js"></script>
<script>
  FunctionServer.run('recur-web');
</script>
```

## API Reference

### Navigation

```javascript
await page.goto('https://example.com');  // Navigate to URL
await page.waitFor(1000);                 // Wait milliseconds
await page.waitForSelector('#element');   // Wait for element
const title = await page.title();         // Get page title
const url = await page.url();             // Get current URL
const html = await page.content();        // Get full HTML
```

### Querying Elements

```javascript
const el = await page.$('selector');           // Query single element
const els = await page.$$('selector');         // Query all elements
const text = await page.$eval('h1', e => e.textContent);  // Eval on element
const hrefs = await page.$$eval('a', els => els.map(a => a.href));
```

### Interactions

```javascript
await page.click('#button');                    // Click element
await page.type('#input', 'hello');             // Type text
await page.type('#input', 'hi', { delay: 100 }); // Type with delay
await page.select('#dropdown', 'value');        // Select option
await page.focus('#element');                   // Focus element
await page.hover('#element');                   // Hover element
```

### Evaluation

```javascript
// Run arbitrary JavaScript in the page context
const result = await page.evaluate(() => {
  return document.querySelectorAll('li').length;
});
```

### Assertions

```javascript
const title = await page.title();
(await page.expect(title)).toBe('Expected Title');
(await page.expect(title)).toContain('Expected');
(await page.expect(title)).toBeTruthy();
(await page.expect(5)).toBeGreaterThan(3);
```

### Screenshots

```javascript
const base64 = await page.screenshot();  // Returns base64 PNG
```

## Example Scripts

### Web Scraping

```javascript
await page.goto('https://news.ycombinator.com');
await page.waitFor(1000);

const stories = await page.$$eval('.titleline > a', els =>
  els.slice(0, 10).map(a => ({
    title: a.textContent,
    url: a.href
  }))
);

stories.forEach((s, i) => {
  console.log(`${i + 1}. ${s.title}`);
});
```

### Form Automation

```javascript
await page.goto('https://example.com/login');

await page.type('#email', 'user@example.com');
await page.type('#password', 'secret');
await page.select('#role', 'admin');
await page.click('#submit');

await page.waitForSelector('.dashboard');
console.log('Login successful!');
```

### Multi-Page Testing

```javascript
const urls = ['https://example.com', 'https://httpbin.org'];

for (const url of urls) {
  await page.goto(url);
  const title = await page.title();
  (await page.expect(title)).toBeTruthy();
  console.log(`${url}: ${title}`);
}
```

## Recording

1. Click **"Record"** button (turns orange)
2. Navigate and interact with the page
3. Click **"Stop"** to end recording
4. Recorded actions appear in the script editor
5. Run the script to replay your actions

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + Enter | Run script |
| Cmd/Ctrl + R | Toggle recording |
| Tab | Insert 2 spaces (in editor) |

## How It Works

recur-web uses a clever technique to gain same-origin access to external pages:

1. **Fetch via CORS proxy** - External pages are fetched through public CORS proxies
2. **URL rewriting** - Relative URLs are converted to absolute
3. **Bridge injection** - A small script is injected to capture user interactions
4. **srcdoc loading** - Content is loaded into an iframe's `srcdoc` attribute, making it same-origin
5. **Full DOM access** - Scripts can now query and manipulate the page freely

This approach works entirely client-side with no server required.

## Limitations

- Some pages may not render correctly due to CORS restrictions on resources
- JavaScript-heavy SPAs may have limited functionality
- Screenshots are simplified text representations
- Some sites block proxy access

## License

MIT

## Author

[William Sharkey](https://github.com/williamsharkey)
