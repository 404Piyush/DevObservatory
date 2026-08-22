// Capture screenshots of all the pages in DevObservatory for the README.
// Uses playwright-core driving the existing Chrome install.

const { chromium } = require('C:/Users/piyus/Documents/DevObservatory/frontend/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '..', 'docs', 'images');
const EMAIL = 'demo@eduvuce.in';
const PASSWORD = 'demopassword12345';

const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'events', path: '/events' },
  { name: 'funnels', path: '/funnels' },
  { name: 'retention', path: '/retention' },
  { name: 'projects', path: '/projects' },
];

async function loginViaApi(context) {
  const res = await context.request.post(BASE + '/api/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error('login failed: ' + res.status());
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await loginViaApi(context);
  const page = await context.newPage();

  for (const { name, path: p } of PAGES) {
    console.log('-> ' + name + ' (' + p + ')');
    // For /login we want the actual login form, not a redirect to /dashboard.
    if (p === '/login') {
      await context.clearCookies();
    }
    try {
      await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      console.log('  networkidle timeout, retrying with domcontentloaded');
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    // Wait for the page to actually render some content
    await page.waitForTimeout(2500);
    console.log('  final URL:', page.url());
    const out = path.join(OUT, name + '.png');
    await page.screenshot({ path: out, fullPage: false });
    console.log('  saved ' + out);
    // Re-login so the next page works
    if (p === '/login') {
      await loginViaApi(context);
    }
  }

  // Bonus: events page with a filter applied + projects page scrolled to webhooks
  console.log('-> events-filter (events page, error filter applied)');
  await page.goto(BASE + '/events', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Apply the "error" event name filter
  try {
    await page.fill('input[placeholder*="event_name" i], input[placeholder*="event" i]', 'error');
    await page.click('button:has-text("Apply"), button:has-text("Search"), button:has-text("Filter")');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('  could not apply filter:', e.message);
  }
  await page.screenshot({ path: path.join(OUT, 'events-filter.png'), fullPage: false });
  console.log('  saved events-filter.png');

  console.log('-> webhooks (projects page, scrolled to webhooks section)');
  await page.goto(BASE + '/projects', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Scroll down so the webhooks card is in view
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'webhooks.png'), fullPage: false });
  console.log('  saved webhooks.png');

  await browser.close();
  console.log('DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
