# -*- coding: utf-8 -*-
"""Genera public/manual/index.html a partir de contenido.py y manual.css.

uso (desde la raiz del repo):  python manual-src/gen.py      (requiere Pillow)
Las capturas viven en public/manual/*.webp; manual.js se edita directo en public/manual.
"""
import os, re, html
from contenido import GRUPOS, PRIMER_DIA, FAQ

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..'))
IMAGENES = os.path.join(RAIZ, 'manual-privado', 'img')   # privadas: solo las sirve api/manual.js
PRIVADO = os.path.join(RAIZ, 'manual-privado')
PUBLICO = os.path.join(RAIZ, 'public', 'manual')           # solo el cascaron y manual.js
from PIL import Image
DIMS = {f[:-5]: Image.open(os.path.join(IMAGENES, f)).size for f in os.listdir(IMAGENES) if f.endswith('.webp')}
VERSION = '20261013'


def plano(t):
    t = re.sub(r'<[^>]+>', ' ', t)
    return html.unescape(re.sub(r'\s+', ' ', t)).strip()


def img(nombre, alt, ancha=False):
    w, h = DIMS[nombre]
    return ('<img data-n="%s" alt="%s" width="%d" height="%d" style="aspect-ratio:%d/%d" decoding="async">'
            % (nombre, html.escape(alt, quote=True), w, h, w, h))


def bloque(b, tema_id, idx):
    tipo = b[0]
    if tipo == 'fig':
        _, arch, pie, marcas, modo = b
        w, h = DIMS[arch]
        ancha = w > 900
        clase = 'fig movil' if modo == 'movil' else ('fig ancha' if ancha else 'fig')
        out = '<figure class="%s">' % clase
        out += '<a class="zoom" href="#" data-zoom data-n="%s">%s</a>' % (arch, img(arch, pie))
        out += '<figcaption>'
        if marcas:
            out += '<p class="pie">%s</p><ol class="marcas">' % html.escape(pie)
            out += ''.join('<li>%s</li>' % m for m in marcas)
            out += '</ol>'
        else:
            out += '<p class="pie">%s</p>' % html.escape(pie)
        out += '</figcaption></figure>'
        return ('movil' if modo == 'movil' else 'otro'), out
    if tipo == 'pasos':
        return 'otro', '<ol class="pasos">%s</ol>' % ''.join('<li>%s</li>' % x for x in b[1])
    if tipo == 'lista':
        return 'otro', '<ul class="vinetas">%s</ul>' % ''.join('<li>%s</li>' % x for x in b[1])
    if tipo == 'tip':
        return 'otro', '<p class="nota tip"><strong>Consejo.</strong> %s</p>' % b[1]
    if tipo == 'aviso':
        return 'otro', '<p class="nota aviso"><strong>Ojo.</strong> %s</p>' % b[1]
    if tipo == 'p':
        return 'otro', '<p>%s</p>' % b[1]
    raise ValueError(tipo)


def tema(t):
    partes = []
    fila = []
    for i, b in enumerate(t['bloques']):
        modo, h = bloque(b, t['id'], i)
        if modo == 'movil':
            fila.append(h)
            continue
        if fila:
            partes.append('<div class="moviles">%s</div>' % ''.join(fila)); fila = []
        partes.append(h)
    if fila:
        partes.append('<div class="moviles">%s</div>' % ''.join(fila))
    cuerpo = '\n'.join(partes)
    texto = plano(t['titulo'] + ' ' + t['intro'] + ' ' + cuerpo)
    return ('<section class="tema" id="%s" data-t="%s">\n<h3><a href="#%s" class="ancla" aria-label="Enlace a este tema">#</a>%s</h3>\n<p class="intro">%s</p>\n%s\n</section>'
            % (t['id'], html.escape(texto.lower(), quote=True), t['id'], t['titulo'], t['intro'], cuerpo))


# ---------------------------------------------------------------- navegación
nav = []
for gid, gtit, temas in GRUPOS:
    nav.append('<div class="nav-grupo" data-g="%s"><p class="nav-tit">%s</p><ul>%s</ul></div>' % (
        gid, gtit, ''.join('<li data-n="%s"><a href="#%s">%s</a></li>' % (t['id'], t['id'], t['titulo']) for t in temas)))
nav.append('<div class="nav-grupo" data-g="faq"><p class="nav-tit">Preguntas frecuentes</p><ul><li data-n="faq"><a href="#faq">Dudas comunes</a></li></ul></div>')

# ---------------------------------------------------------------- primer día
dia = ''.join(
    '<li><a href="#%s"><span class="n">%d</span><span class="t"><strong>%s</strong><span>%s</span></span></a></li>' % (a, i + 1, t, d)
    for i, (a, t, d) in enumerate(PRIMER_DIA))

# ---------------------------------------------------------------- cuerpo
cuerpo = []
for gid, gtit, temas in GRUPOS:
    cuerpo.append('<div class="grupo" data-g="%s"><h2 class="grupo-tit">%s</h2>' % (gid, gtit))
    cuerpo.extend(tema(t) for t in temas)
    cuerpo.append('</div>')

faq = ''.join(
    '<details class="pregunta" data-t="%s"><summary>%s</summary><div>%s</div></details>' % (
        html.escape(plano(q + ' ' + a).lower(), quote=True), q, '<p>%s</p>' % a)
    for q, a in FAQ)
cuerpo.append('<div class="grupo" data-g="faq"><h2 class="grupo-tit">Preguntas frecuentes</h2><section class="tema" id="faq" data-faq>%s</section></div>' % faq)

CSS = open(os.path.join(AQUI, 'manual.css'), encoding='utf-8').read()

FRAGMENTO = '''<div class="shell">
  <aside class="indice" id="indice" aria-label="Índice del manual">
    <label class="buscar"><span class="sr">Buscar en el manual</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input type="search" id="buscador" placeholder="Buscar en el manual" autocomplete="off">
    </label>
    <nav>%(nav)s</nav>
  </aside>
  <main id="contenido">
    <section class="portada">
      <p class="sobre">Manual de uso</p>
      <h1>Usa Kaserita paso a paso</h1>
      <p class="sub">Cada pantalla del sistema con su captura, los botones numerados y qué hace cada uno. Desde abrir la caja hasta atender los pedidos de tu tienda online.</p>
      <p class="datos">Las capturas usan datos de ejemplo de la Bodega Demo.</p>
      <h2 class="dia-tit">Tu primer día en 6 pasos</h2>
      <ol class="dia">%(dia)s</ol>
    </section>
    <p class="sin-resultados" hidden>No encontramos nada con esa búsqueda. Prueba con otra palabra, por ejemplo «caja», «stock» o «pedido».</p>
%(cuerpo)s
    <footer class="pie-pagina">
      <p>¿Algo no coincide con lo que ves en tu pantalla? El sistema se actualiza seguido y las capturas pueden tener pequeñas diferencias.</p>
      <p><a href="/pos">Ir al POS</a> · <a href="/terminos">Condiciones del servicio</a> · <a href="/privacidad">Privacidad</a></p>
    </footer>
  </main>
</div>
''' % dict(nav=''.join(nav), dia=dia, cuerpo='\n'.join(cuerpo))

CASCARON = '''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manual de uso - Kaserita</title>
<meta name="description" content="Manual de uso de Kaserita para quienes ya tienen una cuenta.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#faf8f6">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
%(css)s
</style>
</head>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="barra">
  <button class="btn-menu" type="button" aria-label="Abrir índice" aria-expanded="false" aria-controls="indice" hidden><span></span><span></span><span></span></button>
  <a class="marca" href="/manual"><span class="marca-icono"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9L12 4l8 5v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1V9z" fill="#fff"/></svg></span>Kaser<span>ita</span><em>Manual de uso</em></a>
  <a class="ir-pos" href="/pos">Ir al POS</a>
</header>
<div class="velo" hidden></div>
<div id="app" aria-live="polite"><p class="estado">Cargando el manual…</p></div>
<dialog class="visor" id="visor" aria-label="Imagen ampliada"><button type="button" class="visor-cerrar" aria-label="Cerrar">&times;</button><img alt=""></dialog>
<script src="/manual/manual.js?v=%(v)s"></script>
</body>
</html>
''' % dict(css=CSS, v=VERSION)

os.makedirs(PRIVADO, exist_ok=True)
open(os.path.join(PRIVADO, 'contenido.html'), 'w', encoding='utf-8', newline='\n').write(FRAGMENTO)
open(os.path.join(PUBLICO, 'index.html'), 'w', encoding='utf-8', newline='\n').write(CASCARON)
print('contenido.html (privado)', len(FRAGMENTO) // 1024, 'KB | index.html (cascaron publico)', len(CASCARON) // 1024, 'KB')
