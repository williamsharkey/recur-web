// recur-web.js - Browser Automation IDE for FunctionServer
// A recursive browser inside a browser with Puppeteer-like scripting
// https://github.com/williamsharkey/recur-web

(function() {
    const APP_NAME = 'recur-web';
    const APP_TITLE = 'recur-web';

    if (typeof FunctionServer === 'undefined') {
        console.error('recur-web requires FunctionServer OS');
        return;
    }

    FunctionServer.registerApp(APP_NAME, async function(params) {
        const win = FunctionServer.Window.create({
            title: APP_TITLE,
            width: 1200,
            height: 800,
            ...params
        });

        const content = win.getContentArea();
        content.style.cssText = `
            display: flex;
            flex-direction: column;
            background: #1a1a2e;
            color: #eee;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 12px;
            overflow: hidden;
        `;

        // State
        let isRecording = false;
        let recordedActions = [];
        let pageDocument = null;
        let pageWindow = null;
        let currentUrl = '';

        // ═══════════════════════════════════════════════════════════════
        // TOOLBAR
        // ═══════════════════════════════════════════════════════════════
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: linear-gradient(180deg, #2a2a4a 0%, #1f1f3a 100%);
            border-bottom: 1px solid #3a3a5a;
            flex-shrink: 0;
        `;

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'Enter URL or paste HTML...';
        urlInput.value = 'about:blank';
        urlInput.style.cssText = `
            flex: 1;
            padding: 8px 12px;
            background: #0d0d1a;
            border: 1px solid #3a3a5a;
            border-radius: 4px;
            color: #fff;
            font-family: inherit;
            font-size: 12px;
            outline: none;
        `;
        urlInput.onfocus = () => urlInput.style.borderColor = '#6366f1';
        urlInput.onblur = () => urlInput.style.borderColor = '#3a3a5a';

        const createBtn = (label, color, onClick) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `
                padding: 8px 16px;
                background: ${color};
                border: none;
                border-radius: 4px;
                color: #fff;
                font-family: inherit;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;
            `;
            btn.onmouseenter = () => btn.style.filter = 'brightness(1.2)';
            btn.onmouseleave = () => btn.style.filter = 'brightness(1)';
            btn.onclick = onClick;
            return btn;
        };

        const goBtn = createBtn('Go', '#4f46e5', () => navigate(urlInput.value));
        const recordBtn = createBtn('◉ Record', '#dc2626', toggleRecord);
        const runBtn = createBtn('▶ Run', '#16a34a', runScript);
        const clearBtn = createBtn('Clear', '#6b7280', () => {
            consoleOutput.innerHTML = '';
            log('Console cleared', 'system');
        });

        toolbar.append(urlInput, goBtn, recordBtn, runBtn, clearBtn);

        // ═══════════════════════════════════════════════════════════════
        // MAIN LAYOUT (3 columns)
        // ═══════════════════════════════════════════════════════════════
        const mainArea = document.createElement('div');
        mainArea.style.cssText = `
            display: flex;
            flex: 1;
            overflow: hidden;
        `;

        // Left: Browser + Inspector
        const leftPanel = document.createElement('div');
        leftPanel.style.cssText = `
            display: flex;
            flex-direction: column;
            width: 50%;
            border-right: 1px solid #3a3a5a;
        `;

        // Browser View
        const browserHeader = document.createElement('div');
        browserHeader.style.cssText = `
            padding: 6px 12px;
            background: #252540;
            border-bottom: 1px solid #3a3a5a;
            font-weight: 600;
            color: #a5b4fc;
        `;
        browserHeader.textContent = '🌐 Browser';

        const browserContainer = document.createElement('div');
        browserContainer.style.cssText = `
            flex: 1;
            background: #fff;
            position: relative;
            overflow: hidden;
        `;

        const browserFrame = document.createElement('iframe');
        browserFrame.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
        `;
        browserFrame.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
        browserContainer.appendChild(browserFrame);

        // Loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            display: none;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 14px;
        `;
        loadingOverlay.innerHTML = '<div style="text-align:center"><div style="font-size:24px;margin-bottom:8px">⏳</div>Loading...</div>';
        browserContainer.appendChild(loadingOverlay);

        // Inspector
        const inspectorHeader = document.createElement('div');
        inspectorHeader.style.cssText = `
            padding: 6px 12px;
            background: #252540;
            border-top: 1px solid #3a3a5a;
            border-bottom: 1px solid #3a3a5a;
            font-weight: 600;
            color: #a5b4fc;
            cursor: pointer;
        `;
        inspectorHeader.textContent = '🔍 Inspector';

        const inspector = document.createElement('div');
        inspector.style.cssText = `
            height: 150px;
            overflow: auto;
            background: #0d0d1a;
            padding: 8px;
            font-size: 11px;
            color: #94a3b8;
        `;

        leftPanel.append(browserHeader, browserContainer, inspectorHeader, inspector);

        // Right: Script + Console
        const rightPanel = document.createElement('div');
        rightPanel.style.cssText = `
            display: flex;
            flex-direction: column;
            flex: 1;
        `;

        // Script Editor
        const scriptHeader = document.createElement('div');
        scriptHeader.style.cssText = `
            padding: 6px 12px;
            background: #252540;
            border-bottom: 1px solid #3a3a5a;
            font-weight: 600;
            color: #a5b4fc;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        scriptHeader.innerHTML = '<span>📜 Script</span>';

        const examplesSelect = document.createElement('select');
        examplesSelect.style.cssText = `
            padding: 4px 8px;
            background: #1a1a2e;
            border: 1px solid #3a3a5a;
            border-radius: 4px;
            color: #fff;
            font-size: 11px;
            cursor: pointer;
        `;
        examplesSelect.innerHTML = `
            <option value="">Load Example...</option>
            <option value="basic">Basic Navigation</option>
            <option value="scrape">Web Scraping</option>
            <option value="form">Form Automation</option>
            <option value="test">Assertion Testing</option>
            <option value="loop">Multi-Page Loop</option>
        `;
        examplesSelect.onchange = () => {
            if (examplesSelect.value) {
                scriptEditor.value = EXAMPLES[examplesSelect.value];
                examplesSelect.value = '';
            }
        };
        scriptHeader.appendChild(examplesSelect);

        const scriptEditor = document.createElement('textarea');
        scriptEditor.style.cssText = `
            flex: 1;
            background: #0d0d1a;
            border: none;
            color: #e2e8f0;
            padding: 12px;
            font-family: inherit;
            font-size: 12px;
            line-height: 1.6;
            resize: none;
            outline: none;
            tab-size: 2;
        `;
        scriptEditor.spellcheck = false;
        scriptEditor.value = `// recur-web Automation Script
// Puppeteer-like API running in the browser!

// Navigate to a page
await page.goto('https://example.com');

// Wait and query
await page.waitFor(500);
const title = await page.title();
console.log('Page title:', title);

// Get element text
const heading = await page.$eval('h1', el => el.textContent);
console.log('Heading:', heading);

// Get all links
const links = await page.$$eval('a', els =>
  els.map(a => ({ text: a.textContent, href: a.href }))
);
console.log('Links found:', links.length);
links.forEach(l => console.log(' -', l.text, l.href));

// Screenshot (base64)
const screenshot = await page.screenshot();
console.log('Screenshot taken:', screenshot.slice(0, 50) + '...');

console.log('✓ Script complete!');`;

        // Tab key support
        scriptEditor.onkeydown = (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = scriptEditor.selectionStart;
                const end = scriptEditor.selectionEnd;
                scriptEditor.value = scriptEditor.value.substring(0, start) + '  ' + scriptEditor.value.substring(end);
                scriptEditor.selectionStart = scriptEditor.selectionEnd = start + 2;
            }
        };

        // Console
        const consoleHeader = document.createElement('div');
        consoleHeader.style.cssText = `
            padding: 6px 12px;
            background: #252540;
            border-top: 1px solid #3a3a5a;
            border-bottom: 1px solid #3a3a5a;
            font-weight: 600;
            color: #a5b4fc;
        `;
        consoleHeader.textContent = '💻 Console';

        const consoleOutput = document.createElement('div');
        consoleOutput.style.cssText = `
            height: 200px;
            overflow: auto;
            background: #0d0d1a;
            padding: 8px 12px;
            font-size: 11px;
        `;

        rightPanel.append(scriptHeader, scriptEditor, consoleHeader, consoleOutput);
        mainArea.append(leftPanel, rightPanel);
        content.append(toolbar, mainArea);

        // ═══════════════════════════════════════════════════════════════
        // LOGGING
        // ═══════════════════════════════════════════════════════════════
        function log(msg, type = 'log') {
            const line = document.createElement('div');
            line.style.cssText = `
                padding: 2px 0;
                border-bottom: 1px solid #1a1a2e;
                word-break: break-all;
            `;
            const colors = {
                log: '#e2e8f0',
                info: '#60a5fa',
                warn: '#fbbf24',
                error: '#f87171',
                system: '#a78bfa',
                record: '#f472b6'
            };
            line.style.color = colors[type] || colors.log;

            const time = new Date().toLocaleTimeString('en-US', { hour12: false });
            const prefix = type === 'system' ? '⚙' : type === 'record' ? '◉' : '›';

            if (typeof msg === 'object') {
                try {
                    msg = JSON.stringify(msg, null, 2);
                } catch (e) {
                    msg = String(msg);
                }
            }

            line.textContent = `[${time}] ${prefix} ${msg}`;
            consoleOutput.appendChild(line);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }

        // ═══════════════════════════════════════════════════════════════
        // NAVIGATION & PAGE ACCESS
        // ═══════════════════════════════════════════════════════════════

        // CORS proxy for cross-origin requests
        const CORS_PROXIES = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
        ];
        let currentProxy = 0;

        async function fetchWithProxy(url) {
            // Try direct fetch first (same-origin)
            try {
                const resp = await fetch(url, { mode: 'cors' });
                if (resp.ok) return await resp.text();
            } catch (e) {
                // Cross-origin, try proxies
            }

            // Try proxies
            for (let i = 0; i < CORS_PROXIES.length; i++) {
                const proxyIndex = (currentProxy + i) % CORS_PROXIES.length;
                try {
                    const proxyUrl = CORS_PROXIES[proxyIndex] + encodeURIComponent(url);
                    const resp = await fetch(proxyUrl);
                    if (resp.ok) {
                        currentProxy = proxyIndex;
                        return await resp.text();
                    }
                } catch (e) {
                    continue;
                }
            }
            throw new Error('Failed to fetch URL through all proxies');
        }

        function rewriteUrls(html, baseUrl) {
            // Rewrite relative URLs to absolute
            const base = new URL(baseUrl);

            // Add base tag
            if (!html.includes('<base')) {
                html = html.replace(/<head[^>]*>/i, `$&<base href="${base.origin}${base.pathname}">`);
            }

            // Rewrite src and href attributes
            html = html.replace(/(src|href)=(["'])(?!data:|javascript:|#|https?:|\/\/)/gi,
                (match, attr, quote) => `${attr}=${quote}${base.origin}/`);

            return html;
        }

        function injectBridge(html) {
            // Inject our bridge script for communication
            const bridgeScript = `
                <script>
                    window.__recurWeb = {
                        clicks: [],
                        inputs: [],
                        ready: true
                    };
                    document.addEventListener('click', (e) => {
                        const path = [];
                        let el = e.target;
                        while (el && el !== document.body) {
                            let selector = el.tagName.toLowerCase();
                            if (el.id) selector += '#' + el.id;
                            else if (el.className) selector += '.' + el.className.split(' ')[0];
                            path.unshift(selector);
                            el = el.parentElement;
                        }
                        window.__recurWeb.clicks.push({
                            selector: path.join(' > '),
                            time: Date.now()
                        });
                        window.parent.postMessage({
                            type: 'recur-click',
                            selector: path.join(' > '),
                            text: e.target.textContent?.slice(0, 50)
                        }, '*');
                    }, true);
                    document.addEventListener('input', (e) => {
                        const el = e.target;
                        let selector = el.tagName.toLowerCase();
                        if (el.id) selector = '#' + el.id;
                        else if (el.name) selector = '[name="' + el.name + '"]';
                        else if (el.className) selector = '.' + el.className.split(' ')[0];
                        window.parent.postMessage({
                            type: 'recur-input',
                            selector: selector,
                            value: el.value
                        }, '*');
                    }, true);
                </script>
            `;

            if (html.includes('</head>')) {
                return html.replace('</head>', bridgeScript + '</head>');
            } else if (html.includes('<body')) {
                return html.replace('<body', bridgeScript + '<body');
            }
            return bridgeScript + html;
        }

        async function navigate(url) {
            loadingOverlay.style.display = 'flex';
            currentUrl = url;
            urlInput.value = url;

            try {
                if (url === 'about:blank' || !url) {
                    browserFrame.srcdoc = '<html><head></head><body style="background:#fff;font-family:system-ui;padding:20px;color:#333"><h1>about:blank</h1><p>Enter a URL above to begin.</p></body></html>';
                    log('Loaded about:blank', 'system');
                } else if (url.startsWith('data:') || url.startsWith('<')) {
                    // Raw HTML
                    const html = url.startsWith('data:') ? atob(url.split(',')[1] || '') : url;
                    browserFrame.srcdoc = injectBridge(html);
                    log('Loaded HTML document', 'system');
                } else {
                    // Fetch URL
                    log(`Fetching: ${url}`, 'system');
                    const html = await fetchWithProxy(url);
                    const rewritten = rewriteUrls(html, url);
                    const injected = injectBridge(rewritten);
                    browserFrame.srcdoc = injected;
                    log(`Loaded: ${url}`, 'system');
                }

                // Wait for load
                await new Promise(resolve => {
                    browserFrame.onload = resolve;
                    setTimeout(resolve, 3000); // Timeout
                });

                // Get references
                pageDocument = browserFrame.contentDocument;
                pageWindow = browserFrame.contentWindow;

                updateInspector();

            } catch (err) {
                log(`Error: ${err.message}`, 'error');
            }

            loadingOverlay.style.display = 'none';
        }

        // Listen for messages from iframe
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'recur-click' && isRecording) {
                const action = `await page.click('${e.data.selector}');`;
                recordedActions.push(action);
                log(`Click: ${e.data.selector}`, 'record');
            } else if (e.data?.type === 'recur-input' && isRecording) {
                const action = `await page.type('${e.data.selector}', '${e.data.value}');`;
                recordedActions.push(action);
                log(`Input: ${e.data.selector} = "${e.data.value}"`, 'record');
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // INSPECTOR
        // ═══════════════════════════════════════════════════════════════
        function updateInspector() {
            if (!pageDocument) {
                inspector.innerHTML = '<span style="color:#64748b">No page loaded</span>';
                return;
            }

            function nodeToHtml(node, depth = 0) {
                if (depth > 4) return '';
                const indent = '  '.repeat(depth);

                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text) return `<span style="color:#94a3b8">${indent}${escapeHtml(text.slice(0, 50))}${text.length > 50 ? '...' : ''}</span>\n`;
                    return '';
                }

                if (node.nodeType !== Node.ELEMENT_NODE) return '';

                const tag = node.tagName.toLowerCase();
                const skipTags = ['script', 'style', 'noscript', 'svg', 'path'];
                if (skipTags.includes(tag)) return `<span style="color:#64748b">${indent}&lt;${tag}&gt;...&lt;/${tag}&gt;</span>\n`;

                let attrs = '';
                if (node.id) attrs += ` <span style="color:#f472b6">id</span>=<span style="color:#a5b4fc">"${node.id}"</span>`;
                if (node.className) attrs += ` <span style="color:#f472b6">class</span>=<span style="color:#a5b4fc">"${node.className}"</span>`;

                let html = `<span style="color:#60a5fa">${indent}&lt;${tag}${attrs}&gt;</span>\n`;

                if (node.children.length > 0 || node.textContent.trim()) {
                    for (const child of node.childNodes) {
                        html += nodeToHtml(child, depth + 1);
                    }
                    html += `<span style="color:#60a5fa">${indent}&lt;/${tag}&gt;</span>\n`;
                }

                return html;
            }

            function escapeHtml(str) {
                return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            try {
                const body = pageDocument.body;
                inspector.innerHTML = `<pre style="margin:0;font-family:inherit">${nodeToHtml(body)}</pre>`;
            } catch (e) {
                inspector.innerHTML = `<span style="color:#f87171">Cannot inspect: ${e.message}</span>`;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // RECORDING
        // ═══════════════════════════════════════════════════════════════
        function toggleRecord() {
            isRecording = !isRecording;
            recordBtn.textContent = isRecording ? '⏹ Stop' : '◉ Record';
            recordBtn.style.background = isRecording ? '#ea580c' : '#dc2626';

            if (isRecording) {
                recordedActions = [`await page.goto('${currentUrl}');`];
                log('Recording started - interact with the page', 'record');
            } else {
                log('Recording stopped', 'record');
                if (recordedActions.length > 1) {
                    scriptEditor.value = `// Recorded Actions\n${recordedActions.join('\n')}\n\nconsole.log('✓ Playback complete!');`;
                    log(`Generated ${recordedActions.length} actions`, 'system');
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PAGE API (Puppeteer-like)
        // ═══════════════════════════════════════════════════════════════
        const page = {
            async goto(url) {
                await navigate(url);
                return { url };
            },

            async title() {
                return pageDocument?.title || '';
            },

            async content() {
                return pageDocument?.documentElement?.outerHTML || '';
            },

            async url() {
                return currentUrl;
            },

            async waitFor(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            },

            async waitForSelector(selector, options = {}) {
                const timeout = options.timeout || 5000;
                const start = Date.now();
                while (Date.now() - start < timeout) {
                    const el = pageDocument?.querySelector(selector);
                    if (el) return el;
                    await new Promise(r => setTimeout(r, 100));
                }
                throw new Error(`Timeout waiting for selector: ${selector}`);
            },

            async $(selector) {
                return pageDocument?.querySelector(selector);
            },

            async $$(selector) {
                return Array.from(pageDocument?.querySelectorAll(selector) || []);
            },

            async $eval(selector, fn) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                return fn(el);
            },

            async $$eval(selector, fn) {
                const els = Array.from(pageDocument?.querySelectorAll(selector) || []);
                return fn(els);
            },

            async click(selector) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                el.click();
                return true;
            },

            async type(selector, text, options = {}) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                el.focus();
                if (options.clear !== false) el.value = '';
                for (const char of text) {
                    el.value += char;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    if (options.delay) await new Promise(r => setTimeout(r, options.delay));
                }
                return true;
            },

            async select(selector, value) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                el.value = value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return [value];
            },

            async focus(selector) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                el.focus();
                return true;
            },

            async hover(selector) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                return true;
            },

            async screenshot() {
                // Use html2canvas-like approach with canvas
                try {
                    const canvas = document.createElement('canvas');
                    const rect = browserFrame.getBoundingClientRect();
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    const ctx = canvas.getContext('2d');

                    // Draw white background
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Simple text rendering of page content
                    ctx.fillStyle = '#000';
                    ctx.font = '14px system-ui';
                    const text = pageDocument?.body?.innerText || '';
                    const lines = text.split('\n').slice(0, 30);
                    lines.forEach((line, i) => {
                        ctx.fillText(line.slice(0, 100), 10, 20 + i * 18);
                    });

                    return canvas.toDataURL('image/png');
                } catch (e) {
                    throw new Error('Screenshot failed: ' + e.message);
                }
            },

            async evaluate(fn, ...args) {
                try {
                    return pageWindow?.eval(`(${fn.toString()})(${args.map(a => JSON.stringify(a)).join(',')})`);
                } catch (e) {
                    throw new Error('Evaluate failed: ' + e.message);
                }
            },

            async getAttribute(selector, attr) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                return el.getAttribute(attr);
            },

            async getProperty(selector, prop) {
                const el = pageDocument?.querySelector(selector);
                if (!el) throw new Error(`Element not found: ${selector}`);
                return el[prop];
            },

            // Assertions for testing
            async expect(value) {
                return {
                    toBe: (expected) => {
                        if (value !== expected) throw new Error(`Expected "${expected}" but got "${value}"`);
                        return true;
                    },
                    toContain: (expected) => {
                        if (!String(value).includes(expected)) throw new Error(`Expected "${value}" to contain "${expected}"`);
                        return true;
                    },
                    toBeTruthy: () => {
                        if (!value) throw new Error(`Expected truthy value but got "${value}"`);
                        return true;
                    },
                    toBeGreaterThan: (expected) => {
                        if (!(value > expected)) throw new Error(`Expected ${value} > ${expected}`);
                        return true;
                    }
                };
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // SCRIPT EXECUTION
        // ═══════════════════════════════════════════════════════════════
        async function runScript() {
            log('═══ Script Started ═══', 'system');
            runBtn.disabled = true;
            runBtn.textContent = '⏳ Running...';

            const code = scriptEditor.value;

            // Custom console that logs to our console
            const customConsole = {
                log: (...args) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'log'),
                info: (...args) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'info'),
                warn: (...args) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'warn'),
                error: (...args) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error'),
            };

            try {
                // Create async function with our API
                const asyncFn = new Function('page', 'console', 'expect', `
                    return (async () => {
                        ${code}
                    })();
                `);

                await asyncFn(page, customConsole, page.expect);
                log('═══ Script Completed ═══', 'system');

            } catch (err) {
                log(`Error: ${err.message}`, 'error');
                log(`Stack: ${err.stack?.split('\n')[1] || 'N/A'}`, 'error');
            }

            runBtn.disabled = false;
            runBtn.textContent = '▶ Run';
            updateInspector();
        }

        // ═══════════════════════════════════════════════════════════════
        // EXAMPLE SCRIPTS
        // ═══════════════════════════════════════════════════════════════
        const EXAMPLES = {
            basic: `// Basic Navigation Example
await page.goto('https://example.com');
await page.waitFor(500);

const title = await page.title();
console.log('Page Title:', title);

const url = await page.url();
console.log('Current URL:', url);

console.log('✓ Navigation complete!');`,

            scrape: `// Web Scraping Example
await page.goto('https://news.ycombinator.com');
await page.waitFor(1000);

// Get all story titles
const stories = await page.$$eval('.titleline > a', els =>
  els.slice(0, 10).map(a => ({
    title: a.textContent,
    url: a.href
  }))
);

console.log('Top 10 Hacker News Stories:');
stories.forEach((s, i) => {
  console.log(\`\${i + 1}. \${s.title}\`);
});

console.log('✓ Scraping complete!');`,

            form: `// Form Automation Example
// First, let's create a test form
await page.goto(\`data:text/html,
<html>
<head><title>Test Form</title></head>
<body style="font-family:system-ui;padding:20px">
  <h1>Login Form</h1>
  <form id="login">
    <input id="email" type="email" placeholder="Email"><br><br>
    <input id="password" type="password" placeholder="Password"><br><br>
    <select id="role">
      <option value="">Select Role</option>
      <option value="admin">Admin</option>
      <option value="user">User</option>
    </select><br><br>
    <button type="submit">Login</button>
  </form>
  <div id="result"></div>
</body>
</html>\`);

await page.waitFor(300);

// Fill out the form
await page.type('#email', 'test@example.com');
console.log('Entered email');

await page.type('#password', 'secretpassword');
console.log('Entered password');

await page.select('#role', 'admin');
console.log('Selected role');

// Verify values
const email = await page.getProperty('#email', 'value');
const role = await page.getProperty('#role', 'value');

console.log('Form values:', { email, role });
console.log('✓ Form automation complete!');`,

            test: `// Assertion Testing Example
await page.goto('https://example.com');
await page.waitFor(500);

console.log('Running tests...');

// Test 1: Page title
const title = await page.title();
(await page.expect(title)).toContain('Example');
console.log('✓ Test 1: Title contains "Example"');

// Test 2: H1 exists
const h1 = await page.$('h1');
(await page.expect(h1)).toBeTruthy();
console.log('✓ Test 2: H1 element exists');

// Test 3: H1 text content
const h1Text = await page.$eval('h1', el => el.textContent);
(await page.expect(h1Text)).toContain('Example');
console.log('✓ Test 3: H1 contains "Example"');

// Test 4: Links exist
const linkCount = await page.$$eval('a', els => els.length);
(await page.expect(linkCount)).toBeGreaterThan(0);
console.log('✓ Test 4: Page has links');

console.log('═══════════════════════');
console.log('All tests passed! ✓');`,

            loop: `// Multi-Page Loop Example
const urls = [
  'https://example.com',
  'https://httpbin.org/html',
  'https://jsonplaceholder.typicode.com'
];

const results = [];

for (const url of urls) {
  console.log('Visiting:', url);
  await page.goto(url);
  await page.waitFor(500);

  const title = await page.title();
  const bodyLength = await page.$eval('body', el => el.innerText.length);

  results.push({ url, title, bodyLength });
  console.log('  Title:', title);
  console.log('  Body length:', bodyLength);
}

console.log('');
console.log('Summary:');
results.forEach(r => {
  console.log(\`  \${r.title}: \${r.bodyLength} chars\`);
});

console.log('✓ Multi-page crawl complete!');`
        };

        // ═══════════════════════════════════════════════════════════════
        // KEYBOARD SHORTCUTS
        // ═══════════════════════════════════════════════════════════════
        content.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                runScript();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
                e.preventDefault();
                toggleRecord();
            }
        });

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                navigate(urlInput.value);
            }
        });

        // Initial state
        log('recur-web initialized', 'system');
        log('Cmd/Ctrl+Enter to run script', 'system');
        log('Cmd/Ctrl+R to toggle recording', 'system');
        navigate('about:blank');

        return win;
    });

    console.log('recur-web app registered');
})();
