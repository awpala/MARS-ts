import { chromium, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const base = resolve(root, '__build/standalone-checks');
mkdirSync(base, { recursive: true });
const output = mkdtempSync(resolve(base, 'run-'));
const icons = readdirSync(resolve(root, 'static/icons')).filter((name) => name.endsWith('.svg'));
const metadata = {
  release: resolve(root, 'standalone'),
  icons,
  glyphs: icons
    .filter((name) =>
      readFileSync(resolve(root, 'static/icons', name), 'utf8').includes('id="icon"')
    )
    .map((name) => name.slice(0, -4))
};
console.log('Evidence:', output);
const html = readFileSync(resolve(metadata.release, 'MARS-ts.html'), 'utf8');
const iconUrls = [...new Set(html.match(/data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+/g))];
expect(iconUrls).toHaveLength(metadata.icons.length);
const testDirectory = resolve(output, 'isolated path with spaces/renamed 日本語');
mkdirSync(testDirectory, { recursive: true });
cpSync(resolve(metadata.release, 'MARS-ts.html'), resolve(testDirectory, 'MARS-ts renamed.html'));
console.log('PASS: artifact embeds all', iconUrls.length, 'SVG image/mask payloads.');

const browser = await chromium.launch();
const context = await browser.newContext({
  offline: true,
  viewport: { width: 1440, height: 1000 }
});
const page = await context.newPage();
const requests = [];
const errors = [];
const consoleErrors = [];
page.on('request', (request) => requests.push(request.url()));
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
const button = (name) => page.getByRole('button', { name, exact: true });
try {
  console.log('Browser:', browser.version());
  const file = resolve(testDirectory, 'MARS-ts renamed.html');
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  );
  await page.goto(pathToFileURL(file).href);
  await expect(page.getByTestId('desktop-controls')).toHaveAttribute('aria-busy', 'false', {
    timeout: 30000
  });
  console.log(
    'PASS: file URL desktop ready, offline context, HTML alone in directory with spaces.'
  );
  await checkIcons('light');
  await page.screenshot({ path: resolve(output, 'desktop-light.png') });
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await checkIcons('dark');
  await page.screenshot({ path: resolve(output, 'desktop-dark.png') });
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await button('New').click();
  await page
    .getByRole('textbox', { name: /^Source / })
    .fill('.text\nli $a0, 42\nli $v0, 1\nsyscall\nli $v0, 10\nsyscall\n');
  await button('Assemble').click();
  await button('Step').click();
  await button('Backstep').click();
  await button('Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue(/42/);
  console.log('PASS: create/edit/assemble/step/backstep/run and print 42.');
  await checkIcons('light-execute');
  await page.screenshot({ path: resolve(output, 'execute-light.png') });
  const articles = [
    ['Introduction', 'Introduction', 'Original article'],
    ['Debugging', 'Interactive Debugging', '2000'],
    ['Settings', 'Configuration Settings', 'localStorage'],
    ['Syscalls', 'Syscalls', 'Tony Brock'],
    ['Exception Handlers', 'Exception Handlers', '.ktext'],
    ['Macros', 'Macros', 'Mohammad Hossein Sekhavat'],
    ['Tools', 'Tools — Legacy Reference', 'mars.tools.MarsTool'],
    ['Limitations', 'Requirements and Limitations', 'Historical Java limitations'],
    ['Release History', 'Release History', '23 January 2008'],
    ['Bugs/Comments', 'Bug Reporting and General Comments', 'PSanderson@otterbein.edu'],
    ['Acknowledgements', 'Acknowledgements', 'Updated 18 August 2014']
  ];
  for (const [label, title, retained] of articles) {
    await page.getByTestId('menu-help-trigger').click();
    await page
      .getByRole('navigation', { name: 'Application menus', exact: true })
      .getByRole('button', { name: label, exact: true })
      .click();
    await expect(page.getByRole('dialog', { name: title, exact: true })).toContainText(retained);
    await checkIcons('help-' + label);
    await page.keyboard.press('Escape');
  }
  console.log('PASS: all 11 dynamically imported Help articles opened offline.');
  console.log(
    'Capabilities:',
    await page.evaluate(() => ({
      secure: isSecureContext,
      clipboard: !!navigator.clipboard,
      audio: typeof AudioContext,
      storageKeys: Object.keys(localStorage)
    }))
  );
  await page.reload();
  await expect(page.getByTestId('desktop-controls')).toHaveAttribute('aria-busy', 'false', {
    timeout: 30000
  });
  await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue(/42/);
  console.log('PASS: reload restores session output in same browser context and path.');
  const importing = '.text\nli $v0, 10\nsyscall\n';
  await page.getByLabel('Import assembly files', { exact: true }).setInputFiles({
    name: 'portable.asm',
    mimeType: 'text/plain',
    buffer: Buffer.from(importing)
  });
  await page
    .getByRole('dialog', { name: 'Import sources', exact: true })
    .getByRole('button', { name: 'Import', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: /^Source / })).toHaveValue(importing);
  console.log('PASS: source import from a selected File.');
  const pendingDownload = page.waitForEvent('download');
  await button('Export File').click();
  const download = await pendingDownload;
  expect(readFileSync(await download.path(), 'utf8')).toBe(importing);
  console.log('PASS: Blob download exports exact imported source:', download.suggestedFilename());
  // The whole stored data leaves and re-enters the file-origin page: export, clear storage as a moved file would see it, import.
  const pendingData = page.waitForEvent('download');
  await button('Export MARS').click();
  const dataDownload = await pendingData;
  expect(dataDownload.suggestedFilename()).toBe('mars-ts-data.json');
  const data = readFileSync(await dataDownload.path());
  const exported = JSON.parse(data.toString('utf8'));
  expect(exported.format).toBe('mars-ts-data');
  expect(exported.storage['mars-ts:sources:v1']).toEqual([
    { name: 'portable.asm', source: importing }
  ]);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('desktop-controls')).toHaveAttribute('aria-busy', 'false', {
    timeout: 30000
  });
  await expect(page.getByRole('textbox', { name: /^Source / })).toHaveCount(0);
  await page.getByLabel('Import MARS data file', { exact: true }).setInputFiles({
    name: 'mars-ts-data.json',
    mimeType: 'application/json',
    buffer: data
  });
  const restarted = page.waitForEvent('load');
  await page
    .getByRole('dialog', { name: 'Import MARS data', exact: true })
    .getByRole('button', { name: 'Import', exact: true })
    .click();
  await restarted;
  await expect(page.getByTestId('desktop-controls')).toHaveAttribute('aria-busy', 'false', {
    timeout: 30000
  });
  await expect(page.getByRole('textbox', { name: /^Source / })).toHaveValue(importing);
  console.log('PASS: Export MARS and Import MARS carry the stored data across cleared storage.');
  // Exercise both Kit deployment-check event paths; console errors and sibling requests fail.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByTestId('menu-help-trigger').click();
  await page
    .getByRole('navigation', { name: 'Application menus', exact: true })
    .getByRole('button', { name: 'About MARS', exact: true })
    .click();
  const about = page.getByRole('dialog', { name: 'About MARS', exact: true });
  const licenseLink = about.getByRole('link', {
    name: 'Read the MIT license (opens in a new tab)',
    exact: true
  });
  await expect(licenseLink).toHaveAttribute('href', /^blob:/);
  const popup = page.waitForEvent('popup');
  await licenseLink.click();
  const licensePage = await popup;
  await licensePage.waitForLoadState();
  expect(await licensePage.locator('body').innerText()).toBe(
    readFileSync(resolve(root, 'MARSlicense.txt'), 'utf8')
  );
  await licensePage.close();
  await page.keyboard.press('Escape');
  console.log('PASS: complete MIT license opens offline from embedded bytes.');
  const normalized = await page.evaluate(async () => {
    const samples = [
      'MARSlicense.txt',
      'MarsHelpIntro.html#reference',
      'docs/adrs/0000-port-plan.md',
      '#standalone-fragment',
      'https://example.com/reference',
      'mailto:test@example.com'
    ];
    const container = document.createElement('div');
    const anchors = samples.map((href) => {
      const a = document.createElement('a');
      a.setAttribute('href', href);
      container.append(a);
      return a;
    });
    document.body.append(container);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const result = anchors.map((a) => a.getAttribute('href'));
    container.remove();
    return result;
  });
  expect(normalized).toEqual([
    'https://github.com/awpala/MARS-ts/blob/main/MARSlicense.txt',
    'https://github.com/awpala/MARS-ts/blob/main/src/lib/help/markdown/MarsHelpIntro.md#reference',
    'https://github.com/awpala/MARS-ts/blob/main/docs/adrs/0000-port-plan.md',
    '#standalone-fragment',
    'https://example.com/reference',
    'mailto:test@example.com'
  ]);
  console.log(
    'PASS: late-mounted relative links normalize to GitHub; fragments/external links preserved.'
  );
  await checkIcons('after-reload');
  await checkGallery();
  expect(requests.filter((url) => /\.svg(?:[?#]|$)/.test(url))).toEqual([]);
  expect(requests.filter((url) => /^https?:/.test(url))).toEqual([]);
  expect(consoleErrors).toEqual([]);
  console.log('PASS: no SVG file requests, HTTP requests, or icon console errors.');
  // The initial load, the recovery reload, the cleared-storage reload, and the Import MARS restart.
  expect(requests).toEqual(Array(4).fill(pathToFileURL(file).href));
  console.log(
    'PASS: only HTML document requests, including focus/visibility, reloads, and the Import MARS restart.'
  );
  expect(errors).toEqual([]);
} finally {
  console.log('Page errors:', errors);
  console.log('Request URLs:', [...new Set(requests)]);
  console.log('Console errors:', [...new Set(consoleErrors)]);
  await browser.close();
}

/** Assert actual mounted icon references and decoded image/mask bytes, including late Help icons. */
async function checkIcons(stage) {
  const result = await page.evaluate(async () => {
    const failures = [];
    const uses = [...document.querySelectorAll('use')];
    for (const use of uses) {
      const href = use.getAttribute('href');
      const box = use.getBBox();
      if (
        !href?.startsWith('#mars-standalone-') ||
        !document.getElementById(href.slice(1)) ||
        box.width <= 0 ||
        box.height <= 0
      )
        failures.push({ href, box: { width: box.width, height: box.height } });
    }
    const images = [...document.querySelectorAll('img')];
    for (const img of images) {
      try {
        await img.decode();
      } catch {
        failures.push({ image: img.src });
      }
      if (!img.src.startsWith('data:image/svg+xml;base64,') || !img.naturalWidth)
        failures.push({ image: img.src });
    }
    const masks = [...document.querySelectorAll('[data-testid^="mask-icon-"]')];
    for (const mask of masks) {
      const style = getComputedStyle(mask);
      const match = /^url\(["']?(data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+)["']?\)$/.exec(
        style.maskImage
      );
      if (!match) {
        failures.push({ mask: style.maskImage });
        continue;
      }
      const image = new Image();
      image.src = match[1];
      try {
        await image.decode();
      } catch {
        failures.push({ mask: style.maskImage });
      }
      if (!image.naturalWidth || style.backgroundColor === 'rgba(0, 0, 0, 0)')
        failures.push({ mask: style.maskImage });
    }
    return { failures, uses: uses.length, images: images.length, masks: masks.length };
  });
  expect(result.failures).toEqual([]);
  console.log('PASS: mounted icons', stage, result);
}

/** Exercise every embedded glyph, including variants not initially visible, and capture both palettes. */
async function checkGallery() {
  await page.evaluate(
    ({ glyphs, urls }) => {
      const gallery = document.createElement('section');
      gallery.id = 'standalone-icon-gallery';
      gallery.style.cssText =
        'position:fixed;inset:10px;z-index:99999;background:var(--theme-surface,#fff);color:var(--theme-text,#222);padding:20px;overflow:auto;display:grid;grid-template-columns:repeat(8,1fr);gap:12px';
      for (const glyph of glyphs) {
        const item = document.createElement('div');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '36');
        svg.setAttribute('height', '36');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#mars-standalone-' + glyph + '-icon');
        svg.append(use);
        item.append(svg, document.createTextNode(glyph));
        gallery.append(item);
      }
      for (const [index, url] of urls.entries()) {
        const item = document.createElement('div');
        const img = new Image();
        img.src = url;
        img.width = 32;
        img.height = 32;
        item.append(img, document.createTextNode('SVG ' + (index + 1)));
        gallery.append(item);
      }
      document.body.append(gallery);
    },
    { glyphs: metadata.glyphs, urls: iconUrls }
  );
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    await checkIcons('all-assets-' + theme);
    await page
      .locator('#standalone-icon-gallery')
      .screenshot({ path: resolve(output, 'icons-' + theme + '.png') });
  }
  await page.evaluate(() => document.getElementById('standalone-icon-gallery').remove());
  console.log(
    'PASS: every embedded toolbar glyph has nonzero geometry in both themes:',
    metadata.glyphs.length
  );
}
