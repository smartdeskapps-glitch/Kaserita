import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Revisa los scripts .sql de la raíz del repo para que no vuelvan a colarse
// patrones que ya causaron huecos de seguridad (ver auditoría). Los scripts
// históricos peligrosos llevan un bloque "SCRIPT HISTORICO BLOQUEADO" que los
// hace fallar si alguien los vuelve a correr; esos no se revisan acá.

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const GUARDA = 'SCRIPT HISTORICO BLOQUEADO';
const archivos = readdirSync(RAIZ).filter((f) => f.endsWith('.sql'));
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8');
const sinComentarios = (t) => t.replace(/--[^\n]*/g, '');

// Rollbacks de emergencia: reabren permisos a propósito.
const ES_REVERSA = (f) => /_REVERSA\.sql$/.test(f);
const vigentes = archivos.filter((f) => !ES_REVERSA(f) && !leer(f).includes(GUARDA));

// Solo estas tablas pueden tener permisos directos para anon (formularios o lectura públicos).
const TABLAS_ANON = new Set(['planes_kaserita', 'errores_app', 'analitica_eventos', 'libro_reclamaciones', 'categorias', 'catalogo_maestro']);
// Solo estas funciones pueden ejecutarse sin sesión.
const FUNCIONES_ANON = new Set(['mi_bodega_id']);

describe('scripts SQL vigentes', () => {
  it('hay scripts para revisar', () => {
    expect(vigentes.length).toBeGreaterThan(30);
  });

  it('ninguna política de lectura/escritura abierta (true) para anon', () => {
    const malos = [];
    for (const f of vigentes) {
      const t = sinComentarios(leer(f));
      for (const m of t.match(/create\s+policy[\s\S]*?;/gi) || []) {
        const paraAnon = /\bto\s+[^;]*\banon\b/i.test(m);
        const soloInsert = /\bfor\s+insert\b/i.test(m);
        const abierta = /(using|with\s+check)\s*\(\s*true\s*\)/i.test(m);
        if (paraAnon && abierta && !soloInsert) malos.push(`${f}: ${m.slice(0, 80)}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('anon no ejecuta funciones ni toca tablas fuera de la lista permitida', () => {
    const malos = [];
    for (const f of vigentes) {
      const t = sinComentarios(leer(f));
      for (const m of t.matchAll(/grant\s+execute\s+on\s+function\s+(?:public\.)?(\w+)[^;]*?\bto\b([^;]*)/gi)) {
        if (/\banon\b/i.test(m[2]) && !FUNCIONES_ANON.has(m[1])) malos.push(`${f}: execute ${m[1]}`);
      }
      for (const m of t.matchAll(/grant\s+[a-z, ]+\s+on\s+(?:table\s+)?(?:public\.)?(\w+)\s+to\b([^;]*)/gi)) {
        if (/\banon\b/i.test(m[2]) && !TABLAS_ANON.has(m[1])) malos.push(`${f}: grant en ${m[1]}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('el PIN de acceso en texto plano no vuelve (solo el script que lo elimina lo nombra)', () => {
    const malos = vigentes
      .filter((f) => f !== 'quitar_acceso_dni_pin.sql' && /pin_acceso/i.test(sinComentarios(leer(f))));
    expect(malos).toEqual([]);
  });

  it('nadie vuelve a crear las funciones del acceso DNI+PIN', () => {
    const malos = vigentes.filter((f) => /create\s+(or\s+replace\s+)?function\s+(public\.)?(puede_reclamar_bodega|reclamar_cuenta_bodega|admin_crear_bodega\b|admin_resetear_pin_bodega)/i.test(sinComentarios(leer(f))));
    expect(malos).toEqual([]);
  });

  it('el PIN de cajero no se compara en texto plano', () => {
    const malos = vigentes.filter((f) => /pin_seguridad\s*=\s*p_pin/i.test(sinComentarios(leer(f))));
    expect(malos).toEqual([]);
  });
});

describe('scripts históricos bloqueados', () => {
  it('siguen con su bloque de bloqueo', () => {
    const debenEstarBloqueados = [
      'schema.sql', 'rls_migracion.sql', 'bodegas_rls_fix.sql', 'concurrencia_fix.sql', 'ajustar_stock.sql',
      'toma_inventario.sql', 'cajeros_pin_administrador.sql', 'hashear_pin_cajero.sql',
      'seguridad_pin_flexible_y_pgcrypto.sql', 'panel_admin.sql', 'bodega_telefono.sql',
      'permitir_fotos_bodega_flag.sql', 'reactivar_fotos_bodega_y_flag_catalogo_maestro.sql',
      'seguridad_ronda3_restaurar_y_blindar.sql', 'delivery_permitido.sql', 'admin_eliminar_bodega.sql',
      'registro_publico_planes_y_pagos.sql', 'arreglar_registro_ya_tiene_bodega.sql',
      'libro_reclamaciones_endurecer.sql',
    ];
    const sinGuarda = debenEstarBloqueados.filter((f) => !leer(f).includes(GUARDA));
    expect(sinGuarda).toEqual([]);
  });
});
