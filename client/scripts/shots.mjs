import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: false });
  console.log('shot', name);
}

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await shot('login');
await page.fill('input[type=email]', 'manager@tasktracker.dev');
await page.fill('input[type=password]', 'password123');
await page.click('button.btn-primary');
await page.waitForSelector('.topbar', { timeout: 10000 });
await page.waitForSelector('.metric-value', { timeout: 10000 });
await page.waitForTimeout(1200);
await shot('dashboard');

// Projects
await page.click('a:has-text("Projects")');
await page.waitForTimeout(800);
await shot('projects');

// Open first project
await page.click('.card-title');
await page.waitForTimeout(1000);
await shot('project-detail');

// Open first task
await page.click('.task-link');
await page.waitForTimeout(1000);
await shot('task-detail');

await browser.close();
console.log('done');
