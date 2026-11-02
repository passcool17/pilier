// Séries en alternance (duos) : séance normale, dos raide, dos mal, et « sauter » dans un duo.
// BASE_URL=https://passcool17.github.io/pilier/ SHOTS=dossier node tests/series.e2e.mjs
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
const COTE = { row: true, lunge: true };
const ORDRE = {
  ok: ['goblet', 'row', 'rdl', 'press', 'lunge', 'floor', 'bridge', 'plank'],
  stiff: ['goblet', 'row', 'lunge', 'press', 'bridge', 'floor', 'plank'],
  hurt: ['goblet', 'row', 'bridge', 'press', 'plank'],
};
// Déroulé attendu : A1 B1 A2 B2 A3 B3 par duo ; repos court A→B, normal après B ; pas de repos entre les deux côtés.
function attendu(feel, saute = null) {
  const court = feel === 'hurt' ? 40 : 30, long = feel === 'hurt' ? 75 : 60;
  const ids = ORDRE[feel], pas = [];
  for (let i = 0; i < ids.length; i += 2) {
    const duo = ids.slice(i, i + 2);
    for (let r = 1; r <= 3; r++) for (const id of duo) {
      if (id === saute && pas.some(p => p.id === id)) continue;
      const cotes = id === saute ? ['L'] : COTE[id] ? ['L', 'R'] : [''];
      for (const c of cotes) pas.push({ id, r, c, duo });
    }
  }
  const out = [];
  pas.forEach((p, n) => {
    out.push(`${p.id}${p.r}${p.c}`);
    if (p.id === saute) { out.push('SAUTÉ'); return; }
    const q = pas[n + 1]; if (!q) return;
    if (q.id === saute) { out.push(`(${court})`); return; }
    if (q.id === p.id && q.r === p.r) return; // l'autre côté
    out.push(q.id !== p.id && p.duo[0] === p.id && q.duo === p.duo ? `(${court})` : `(${long})`);
  });
  // après un saut, la série suivante arrive sans repos (comme avant)
  return out;
}
const BOUTON = { stiff: 'Raide', hurt: 'Mal' };
let ok = 0, ko = 0;
const check = (nom, a, b) => { const bon = JSON.stringify(a) === JSON.stringify(b); bon ? ok++ : ko++; console.log(bon ? '✔' : '✘', nom, bon ? '' : `\n   reçu   ${a.join(' ')}\n   attendu ${b.join(' ')}`); };
const shot = async (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });

const b = await chromium.launch();
for (const cas of ['ok', 'stiff', 'hurt', 'skip']) {
  const feel = cas === 'skip' ? 'ok' : cas;
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await ctx.clock.install();
  const p = await ctx.newPage();
  const erreurs = []; p.on('pageerror', e => erreurs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  // l'accueil a déjà un écart d'hydratation (#418) sur main : on ne compte que les erreurs de la séance
  erreurs.length = 0;
  if (BOUTON[feel]) { await p.getByRole('button', { name: BOUTON[feel], exact: true }).first().click(); await p.waitForTimeout(300); }
  await p.getByRole('link', { name: 'Séance', exact: true }).click(); await p.waitForTimeout(900);
  if (cas === 'ok') {
    await p.evaluate(() => { const el = document.querySelector('main ol.flex li'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 160); });
    await shot(p, '1-apercu-duos');
    const etiquettes = await p.locator('main ol.flex li p.text-xs.text-muted:not(:last-child)').allInnerTexts();
    check('aperçu : étiquettes des duos', etiquettes, ['01 · duo 1', '02 · duo 1', '03 · duo 2', '04 · duo 2', '05 · duo 3', '06 · duo 3', '07 · duo 4', '08 · duo 4']);
  }
  await p.getByRole('button', { name: /Commencer/ }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Passer l’échauffement/ }).click(); await p.waitForTimeout(500);
  const vu = [], duos = new Set(); let photos = 0, sauté = false;
  for (let i = 0; i < 80; i++) {
    const titre = (await p.locator('main h1').first().innerText().catch(() => '')).trim();
    const k = Object.keys(N).find(x => N[x] === titre) || (titre === 'À quatre pattes' ? 'plank' : undefined);
    if (!k) break;
    const serie = await p.getByTestId('serie-label').innerText();
    const [, r] = serie.match(/Série (\d) \/ 3/);
    const c = /l’autre côté/.test(serie) ? 'R' : /un côté/.test(serie) ? 'L' : '';
    duos.add((await p.getByTestId('duo-label').textContent()).trim());
    vu.push(`${k}${r}${c}`);
    if (cas === 'ok' && photos < 3 && (vu.length === 1 || vu.length === 2 || vu.length === 4)) { await p.evaluate(() => scrollTo(0, 0)); await shot(p, `${2 + photos}-ecran-${vu.length}-${k}${r}${c}`); photos++; }
    if (cas !== 'ok' && cas !== 'skip' && vu.length === 1) { await p.evaluate(() => scrollTo(0, 0)); await shot(p, `${cas === 'stiff' ? 7 : 8}-${cas}-premier`); }
    if (cas === 'skip' && k === 'row' && !sauté) {
      await p.evaluate(() => scrollTo(0, 0)); await shot(p, '9-skip-avant');
      sauté = true; await p.getByRole('button', { name: 'Sauter celui-là' }).click(); await p.waitForTimeout(400); vu.push('SAUTÉ');
      await p.evaluate(() => scrollTo(0, 0)); await shot(p, '10-skip-apres');
      continue;
    }
    if (k === 'plank') {
      await p.getByRole('button', { name: 'Démarrer la tenue' }).click();
      for (let t = 0; t < 120 && await p.getByRole('button', { name: 'Démarrer la tenue' }).count() === 0
        && !(await p.getByRole('button', { name: 'Sauter le repos' }).isVisible()) && !(await p.getByRole('button', { name: 'Passer les étirements' }).isVisible()); t++) await p.clock.runFor(1000);
    }
    else await p.locator('.action-dock button').click();
    await p.waitForTimeout(250);
    const repos = p.getByRole('button', { name: 'Sauter le repos' });
    if (await repos.isVisible().catch(() => false)) {
      const sec = await p.locator('div.fixed p.text-8xl').innerText();
      vu.push(`(${sec})`);
      if (cas === 'ok' && (vu.length === 2 || vu.length === 5)) await shot(p, `${vu.length === 2 ? 5 : 6}-repos-${sec}s`);
      await repos.click(); await p.waitForTimeout(250);
    }
  }
  const exp = attendu(feel, cas === 'skip' ? 'row' : null);
  check(`déroulé ${cas}`, vu, exp);
  if (cas !== 'skip') check(`étiquettes ${cas}`, [...duos], cas === 'ok'
    ? ['Duo 1 · Squat + Tirage', 'Duo 2 · Hanches + Épaules', 'Duo 3 · Fentes + Poitrine', 'Duo 4 · Pont + Gainage']
    : cas === 'stiff' ? ['Duo 1 · Squat + Tirage', 'Duo 2 · Fentes + Épaules', 'Duo 3 · Pont + Poitrine', 'En solo · Gainage']
    : ['Duo 1 · Squat + Tirage', 'Duo 2 · Pont + Épaules', 'En solo · Quatre pattes']);
  // Journal : chaque mouvement garde ses séries
  await p.getByRole('button', { name: 'Passer les étirements' }).click(); await p.waitForTimeout(400);
  const s = await p.evaluate(() => JSON.parse(localStorage.getItem('pilier-v1')).state.sessions[0]);
  const jr = s.entries.map(e => `${e.exerciseId}:${e.skipped ? 'sauté' : `${e.sets.filter(x => x.done).length}/${e.sets.length}`}`);
  check(`journal ${cas}`, jr, ORDRE[feel].map(id => `${id}:${cas === 'skip' && id === 'row' ? 'sauté' : `${COTE[id] ? 6 : 3}/${COTE[id] ? 6 : 3}`}`));
  if (cas === 'ok') { await p.goto(BASE + 'journal/'); await p.waitForTimeout(1200); await shot(p, '11-journal'); }
  if (erreurs.length) { ko++; console.log('✘ erreurs JS', cas, erreurs); }
  await ctx.close();
}
await b.close();
console.log(`${ok} ok, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
