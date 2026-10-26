// End-to-end check of the on-device room scan in the production build:
// opens the app in Chromium, scans real gym photos from Wikimedia Commons
// and prints what was detected. Run: node scripts/e2e-scan.mjs <url>
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const APP_URL = process.argv[2] ?? 'http://localhost:4173/';
const UA = 'GigFit-CI/1.0 (https://github.com/efn67tungtungtungsahur/Gig)';
const QUERIES = [
  ['treadmill', 'treadmills gym'],
  ['dumbbells', 'dumbbell rack gym'],
  ['squat_rack', 'squat rack'],
  ['bench', 'weight bench dumbbells'],
  ['cable_machine', 'cable crossover machine'],
  ['bike', 'exercise bike gym'],
  ['leg_press', 'leg press machine'],
  ['rower', 'indoor rowing machine'],
  ['kettlebell', 'kettlebells'],
  ['home gym', 'home gym equipment'],
];

async function commonsImage(query) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=5' +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1024`;
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || !/jpeg|png/.test(info.mime)) continue;
    const img = await fetch(info.thumburl ?? info.url, { headers: { 'User-Agent': UA } });
    if (!img.ok) continue;
    return { title: p.title, bytes: Buffer.from(await img.arrayBuffer()) };
  }
  return null;
}

const dir = join(tmpdir(), 'gigfit-scan');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[browser ${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(APP_URL);
await page.locator('.tabbar').getByText('Training', { exact: true }).click();

let ok = 0;
for (const [expected, query] of QUERIES) {
  const img = await commonsImage(query);
  if (!img) {
    console.log(`?? ${expected}: kein Bild gefunden`);
    continue;
  }
  const file = join(dir, `${expected.replace(/\W/g, '_')}.jpg`);
  await writeFile(file, img.bytes);
  const started = Date.now();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Foto (aufnehmen|scannen)/ }).first().click();
  await (await chooser).setFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Erkannte Geräte' });
  // Either the review sheet opens or the app shows an error toast.
  await sheet.or(page.locator('.toast')).first().waitFor({ timeout: 600_000 });
  if (!(await sheet.isVisible())) {
    console.log(`✗ [erwartet: ${expected}] Fehler: ${await page.locator('.toast').textContent()}`);
    await page.locator('.toast').click();
    continue;
  }
  const chips = await Promise.all(
    (await sheet.locator('.chip').all()).map(async (c) => `${(await c.getAttribute('class'))?.includes('on') ? '☑' : '☐'} ${await c.textContent()}`),
  );
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (chips.length) ok++;
  console.log(`${chips.length ? '✓' : '✗'} [erwartet: ${expected}] ${img.title} (${secs}s): ${chips.join(' | ') || '—'}`);
  await sheet.getByRole('button', { name: /Schließen/ }).first().click();
}
await browser.close();
console.log(`Fertig: ${ok}/${QUERIES.length} Fotos mit Erkennungen.`);
if (ok === 0) process.exit(1);
