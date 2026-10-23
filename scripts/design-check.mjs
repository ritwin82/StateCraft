import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const reports = [];
for (const width of [1440, 390, 720]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('heading', { name: 'Small states. Big understanding.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  // 720 CSS pixels exercises the reflow of a 1440px display at 200% browser zoom.
  const inspect = async label => {
    const result = await page.evaluate(() => {
      const visible = el => el.getBoundingClientRect().width && el.getBoundingClientRect().height && getComputedStyle(el).visibility !== 'hidden';
      const targets = [...document.querySelectorAll('button,input:not([type=file]),select')].filter(visible).filter(el => !el.closest('.sr-only'));
      const small = targets.filter(el => { const r = el.getBoundingClientRect(); return r.width < 43.9 || r.height < 43.9; }).map(el => ({ label: el.getAttribute('aria-label') || el.textContent, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
      const effects = [...document.querySelectorAll('*')].filter(visible).filter(el => { const s = getComputedStyle(el); return s.boxShadow !== 'none' || s.backgroundImage.includes('gradient') || s.backdropFilter !== 'none' || s.animationName !== 'none'; }).map(el => el.className);
      return { overflow: document.documentElement.scrollWidth > innerWidth, smallTargets: small, effects };
    });
    reports.push({ width, label, ...result });
  };
  await inspect('practice');
  await page.screenshot({ path: `artifacts/refined-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Edit transitions from q0 to q1: a', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('region', { name: 'Selected transitions' }).waitFor();
  await inspect('selected transition');
  await page.getByRole('button', { name: 'Close transition inspector' }).click();
  await page.getByLabel('Input string').fill('x');
  await page.getByRole('button', { name: 'Run string', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await inspect('error');
  await page.getByRole('button', { name: 'My progress', exact: true }).click();
  await inspect('empty progress');
  await page.getByRole('button', { name: 'Open account' }).click();
  await inspect('account');
  await page.close();
}
function luminance(hex) { const rgb = hex.match(/\w\w/g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v / 12.92 : ((v+.055)/1.055)**2.4); return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722; }
const contrast = (a,b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const contrastChecks = [];
for (const bg of ['E8E4DA','F1EDE3','E2DFD5']) for (const fg of ['252B29','505853','235C50','7B8078']) contrastChecks.push({ fg, bg, ratio: contrast(fg,bg), minimum: fg === '7B8078' ? 3 : 4.5 });
await writeFile('artifacts/design-audit.json', JSON.stringify({ reports, contrastChecks },null,2));
console.log(JSON.stringify({ reports, contrastChecks },null,2));
await browser.close();
if (reports.some(r => r.overflow || r.smallTargets.length || r.effects.length) || contrastChecks.some(c => c.ratio < c.minimum)) process.exitCode = 1;
