import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:5173');
  for (const topic of ['nfa', 'enfa']) {
    await page.getByLabel('Practice topic', { exact: true }).selectOption(topic);
    for (const level of ['easy', 'medium', 'hard']) {
      await page.getByLabel('Question difficulty').selectOption(level);
      assert.equal((await page.locator('.difficulty').textContent()).toLowerCase(), level);
      assert.equal(await page.getByLabel('Machine type').inputValue(), topic === 'nfa' ? 'NFA' : 'ENFA');
      assert.ok((await page.locator('.challenge-intro>p').textContent()).includes(topic === 'nfa' ? 'Build an NFA' : 'Build an ε-NFA'));
      await page.getByRole('button', { name: 'Next challenge', exact: true }).click();
      assert.equal((await page.locator('.difficulty').textContent()).toLowerCase(), level);
    }
  }
  await page.getByRole('button', { name: 'Transition', exact: true }).click();
  await page.getByLabel('Transition symbol').fill('e,ε');
  await page.getByRole('button', { name: 'Save transition' }).click();
  await page.getByRole('button', { name: 'Edit transitions from q0 to q0: ε', exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/categories-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'artifacts/categories-mobile.png', fullPage: true });
  console.log('Passed: NFA and epsilon-NFA, all three difficulty levels, next challenge retains difficulty, matching editor modes, e alias deduplication, mobile overflow.');
} finally { await browser.close(); }
