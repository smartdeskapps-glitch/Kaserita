import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El splash es HTML/CSS estático (pos.html + public/splash-pos.js) y la app lo
// retira llamando a window.ocultarSplashKaserita. Si esa función desaparece, el
// splash se queda tapando la app (pasó al simplificar el splash). Estas pruebas
// leen los archivos tal como se publican y fallan si se rompe el acuerdo.
const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8');

describe('splash de arranque', () => {
  const splashJs = leer('../../public/splash-pos.js');
  const posHtml = leer('../../pos.html');
  const mainJsx = leer('../main.jsx');

  it('splash-pos.js define la función que retira el splash', () => {
    expect(splashJs).toMatch(/window\.ocultarSplashKaserita\s*=\s*function/);
  });

  it('splash-pos.js tiene el salvavidas por tiempo', () => {
    expect(splashJs).toMatch(/setTimeout\(\(\)\s*=>\s*window\.ocultarSplashKaserita\(\)\s*,\s*\d+\)/);
  });

  it('pos.html tiene el splash y carga splash-pos.js', () => {
    expect(posHtml).toContain('id="splash-kaserita"');
    expect(posHtml).toMatch(/<script src="\/splash-pos\.js[^"]*"><\/script>/);
  });

  it('la app retira el splash y tiene respaldo si falta la función', () => {
    expect(mainJsx).toContain('ocultarSplashKaserita');
    expect(mainJsx).toMatch(/getElementById\('splash-kaserita'\)/);
  });
});
