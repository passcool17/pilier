// Échauffement et étirements adaptés aux muscles de la séance (normale, dos raide, dos mal).
// BASE_URL=https://passcool17.github.io/pilier/ SHOTS=dossier node tests/echauffements.e2e.mjs
import { chromium } from 'playwright-core';
import fs from 'fs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18431/pilier/';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const AVANT = {
  ok: ['Marche sur place', 'Mobilité', 'Mini-squats sans poids', 'Pompes contre le mur', 'Charnière à vide', 'Pont sans haltère', 'Genou au sol, hanche ouverte'],
  stiff: ['Marche sur place', 'Mobilité', 'Mini-squats sans poids', 'Pompes contre le mur', 'Pont sans haltère', 'Genou au sol, hanche ouverte'],
  hurt: ['Marche sur place', 'Mobilité', 'Mini-squats sans poids', 'Pompes contre le mur', 'Pont sans haltère'],
};
const APRES = {
  ok: ['Avant de cuisse, debout', 'Arrière de cuisse, léger', 'Haut du dos et dorsaux', 'Épaules et triceps', 'Poitrine dans l’encadrement', 'Avant de la hanche', 'Fessier (figure 4)'],
  stiff: ['Avant de cuisse, debout', 'Haut du dos et dorsaux', 'Épaules et triceps', 'Poitrine dans l’encadrement', 'Avant de la hanche', 'Fessier (figure 4)'],
  hurt: ['Avant de cuisse, debout', 'Haut du dos et dorsaux', 'Épaules et triceps', 'Poitrine dans l’encadrement', 'Fessier (figure 4)'],
};
const BOUTON = { stiff: 'Raide', hurt: 'Mal' };
let ok = 0, ko = 0;
const check = (nom, a, b) => { const bon = JSON.stringify(a) === JSON.stringify(b); bon ? ok++ : ko++; console.log(bon ? '✔' : '✘', nom, bon ? '' : `\n   reçu   ${a.join(' | ')}\n   attendu ${b.join(' | ')}`); };
const shot = async (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const titres = p => p.locator('main ul.mt-6 li button span.block.text-sm.font-medium').allInnerTexts();

const b = await chromium.launch();
for (const feel of ['ok', 'stiff', 'hurt']) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  erreurs.length = 0; // écart d'hydratation connu sur l'accueil
  if (BOUTON[feel]) { await p.getByRole('button', { name: BOUTON[feel], exact: true }).first().click(); await p.waitForTimeout(300); }
  await p.getByRole('link', { name: 'Séance', exact: true }).click(); await p.waitForTimeout(900);
  await p.getByRole('button', { name: /Commencer/ }).click(); await p.waitForTimeout(500);
  check(`échauffement ${feel}`, await titres(p), AVANT[feel]);
  const go = p.getByRole('button', { name: /^Entraînement/ });
  check(`bouton bloqué avant de tout cocher ${feel}`, [await go.isDisabled()], [true]);
  await shot(p, `${feel}-1-echauffement`);
  const n = AVANT[feel].length;
  for (let i = 0; i < n; i++) await p.locator('main ul.mt-6 > li > button').nth(i).click();
  check(`bouton actif après ${n} coches ${feel}`, [await go.isEnabled()], [true]);
  // Aller direct aux étirements (sans faire les séries) puis recharger
  await p.evaluate(() => { const k = 'pilier-v1', s = JSON.parse(localStorage.getItem(k)); s.state.active.phase = 'cooldown'; localStorage.setItem(k, JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  check(`étirements ${feel}`, await titres(p), APRES[feel]);
  const intro = await p.locator('main p.mt-2.text-sm.text-muted').first().innerText();
  check(`texte étirements ${feel}`, [intro.startsWith(`${APRES[feel].length} étirements doux`)], [true]);
  await shot(p, `${feel}-2-etirements`);
  if (erreurs.length) { ko++; console.log('✘ erreurs JS', feel, erreurs); }
  await ctx.close();
}
await b.close();
console.log(`${ok} ok, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
