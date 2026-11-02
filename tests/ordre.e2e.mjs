// Vérifie l'ordre des mouvements de la séance (normale, dos raide, dos mal).
// BASE_URL=https://passcool17.github.io/pilier/ SHOTS=dossier node tests/ordre.e2e.mjs
import { chromium } from 'playwright-core';
import fs from 'fs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18431/pilier/';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const N = {
  goblet: 'Squat, haltère à la poitrine', row: 'Tirer un haltère, un bras', rdl: 'Pencher les hanches',
  press: 'Pousser au-dessus de la tête, assis', lunge: 'Grand pas en arrière', floor: 'Pousser allongé au sol',
  bridge: 'Pont fessier', plank: 'Gainage : à quatre pattes, ou planche',
};
const ATTENDU = {
  ok: ['goblet', 'row', 'rdl', 'press', 'lunge', 'floor', 'bridge', 'plank'],
  stiff: ['goblet', 'row', 'lunge', 'press', 'bridge', 'floor', 'plank'],
  hurt: ['goblet', 'row', 'bridge', 'press', 'plank'],
};
const BOUTON = { stiff: 'Raide', hurt: 'Mal' };
let ok = 0, ko = 0;
const check = (nom, a, b) => { const bon = JSON.stringify(a) === JSON.stringify(b); bon ? ok++ : ko++; console.log(bon ? '✔' : '✘', nom, bon ? '' : `\n   reçu   ${a.join(' > ')}\n   attendu ${b.join(' > ')}`); };
const shot = async (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });

const b = await chromium.launch();
for (const feel of ['ok', 'stiff', 'hurt']) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  if (BOUTON[feel]) { await p.getByRole('button', { name: BOUTON[feel], exact: true }).first().click(); await p.waitForTimeout(400); }
  await p.getByRole('link', { name: 'Séance', exact: true }).click(); await p.waitForTimeout(1000);
  if (feel === 'ok') {
    const apercu = await p.locator('main ol.flex li p.font-medium').allInnerTexts();
    check('aperçu de la séance', apercu, ATTENDU.ok.map(k => N[k]));
    await shot(p, '1-apercu'); await p.locator('main ol.flex').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 300)); await shot(p, '2-apercu-liste');
  }
  await p.getByRole('button', { name: /Commencer/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Passer l’échauffement/ }).click(); await p.waitForTimeout(600);
  const vus = [];
  for (let i = 0; i < 10; i++) {
    const h = p.locator('main h1').first();
    const titre = (await h.innerText().catch(() => '')).trim();
    const k = Object.keys(N).find(x => N[x] === titre) || (titre === 'À quatre pattes' ? 'plank' : undefined); // dos mal : le gainage devient « À quatre pattes »
    if (!k) break;
    vus.push(k);
    if (i < 3) await p.evaluate(() => scrollTo(0, 0));
    if (feel === 'ok' && i < 3) await shot(p, `${3 + i}-mouvement-${i + 1}-${k}`);
    if (feel !== 'ok' && i === 0) await shot(p, `${feel === 'stiff' ? 7 : 8}-${feel}-premier`);
    await p.getByRole('button', { name: 'Sauter celui-là' }).click(); await p.waitForTimeout(500);
  }
  check(`séance ${feel} (mouvements joués)`, vus, ATTENDU[feel]);
  if (feel === 'ok') await shot(p, '6-fin');
  if (erreurs.length) { ko++; console.log('✘ erreurs JS', feel, erreurs); }
  await ctx.close();
}
await b.close();
console.log(`${ok} ok, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
