// Plainbot runner: executes a JSON plan with Playwright.
// Usage: node runner.js <plan.json> <headless: true|false> <outDir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , planPath, headlessArg, outDir] = process.argv;
const headless = headlessArg !== 'false';
const STEP_TIMEOUT = 15000;

const emit = (obj) => console.log(JSON.stringify(obj));
const log = (msg) => emit({ t: 'log', msg });

const ACTIONS = {
  async goto(page, s) {
    if (!/^https?:\/\//i.test(s.url || '')) throw new Error('goto needs a full http(s) url');
    await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  },
  async click(page, s) { await page.locator(s.selector).first().click({ timeout: STEP_TIMEOUT }); },
  async fill(page, s) { await page.locator(s.selector).first().fill(String(s.value ?? ''), { timeout: STEP_TIMEOUT }); },
  async press(page, s) { await page.keyboard.press(s.key || 'Enter'); },
  async wait(page, s) { await page.waitForTimeout(Math.min(Number(s.ms) || 1000, 15000)); },
  async waitForSelector(page, s) { await page.locator(s.selector).first().waitFor({ timeout: STEP_TIMEOUT }); },
  async scroll(page, s) { await page.mouse.wheel(0, Number(s.y) || 800); await page.waitForTimeout(400); },
  async screenshot(page) {
    await page.screenshot({ path: path.join(outDir, 'final.png'), fullPage: false });
  },
  async title(page, s, ctx) { ctx.results[s.as || 'title'] = await page.title(); },
  async extract(page, s, ctx) {
    const loc = page.locator(s.selector);
    await loc.first().waitFor({ timeout: STEP_TIMEOUT });
    const texts = (await loc.allInnerTexts()).map((t) => t.trim()).filter(Boolean).slice(0, 25);
    ctx.results[s.as || 'result'] = texts.length === 1 ? texts[0] : texts;
  },
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const ctx = { results: {} };
  log(`Launching Chromium (${headless ? 'headless' : 'visible window'})`);
  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 450 });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  let failed = false;

  for (const [i, step] of plan.steps.entries()) {
    const label = `Step ${i + 1}/${plan.steps.length}: ${step.action}${step.selector ? ' ' + step.selector : ''}${step.url ? ' ' + step.url : ''}`;
    try {
      const fn = ACTIONS[step.action];
      if (!fn) throw new Error(`Unknown action "${step.action}"`);
      log(label);
      await fn(page, step, ctx);
    } catch (err) {
      log(`FAILED ${label} -> ${String(err.message).split('\n')[0]}`);
      failed = true;
      break;
    }
  }

  try { await page.screenshot({ path: path.join(outDir, 'final.png') }); } catch (_) {}
  emit({ t: 'result', data: ctx.results });
  if (!headless) { log('Keeping window open for 4 seconds...'); await new Promise((r) => setTimeout(r, 4000)); }
  await browser.close();
  log(failed ? 'Job finished with errors' : 'Job finished');
  process.exit(failed ? 1 : 0);
})().catch((e) => { log('Runner crashed: ' + e.message); process.exit(1); });
