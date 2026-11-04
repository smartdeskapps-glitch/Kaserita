# Kaserita

POS + página de inicio + páginas legales de SmartdeskApps. React 18, Vite, Tailwind y Supabase. Se despliega en Vercel desde `main` en https://kaserita.smartdeskapps.com. La tienda virtual (KaseritaDelivery) es otro repositorio: `Kaserita_Delivery`.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm test           # pruebas (Vitest) de la lógica en src/lib
npm run build      # build de producción en dist/
```

La lógica de negocio que se puede probar sola (arqueo de caja, combos, descuentos, validaciones, dashboard, turnos, errores) vive en `src/lib/` con su `*.test.js`. La app principal está en `src/main.jsx`, el panel de superadmin en `src/PanelAdmin.jsx`.

## Despliegue

- Cada push a `main` despliega en Vercel. El comando de build es `npm test && npm run build`: **si una prueba o el build falla, no se despliega** y sigue la versión anterior.
- GitHub Actions (`.github/workflows/ci.yml`) corre lo mismo en cada push y pull request.
- Después de un cambio importante (arranque, cobro, turno, caja) se repite el recorrido de [`PRUEBA_MANUAL.md`](PRUEBA_MANUAL.md) en la Bodega Demo.
- Las claves de Supabase usadas en el navegador son la URL y la clave **publicable**; la seguridad la dan las políticas RLS, no el secreto de la clave.

## Base de datos (Supabase)

Los cambios de base de datos son archivos `.sql` en la raíz que se ejecutan **a mano** en el SQL Editor de Supabase. No hay migraciones automáticas.

**Scripts históricos bloqueados.** Varios scripts antiguos (`schema.sql`, `rls_migracion.sql`, `panel_admin.sql`, `seguridad_ronda3_…`, `hashear_pin_cajero.sql`, etc.) llevan al inicio un bloque `SCRIPT HISTORICO BLOQUEADO` que los hace fallar: volver a correrlos reabriría huecos de seguridad ya cerrados (pasó el 2026-09-23). La lista completa está en `src/lib/sql.test.js`. Para una base nueva, usa un volcado de producción (`supabase db dump`), no esos scripts. `npm test` revisa además que ningún script vigente vuelva a abrir permisos a `anon`, recrear el acceso DNI+PIN o comparar PIN en texto plano.

**Orden de los scripts de seguridad** (cada uno se puede repetir sin problema; correrlos en el SQL Editor de Kaserita después de publicar la app):

1. `quitar_acceso_dni_pin.sql`: borra el acceso viejo DNI+PIN (cuentas `bodega_…@kaserita.app`, funciones, tabla y columna `pin_acceso`).
2. `autorizacion_por_rol.sql`: roles en el servidor (PIN de Dueño/Administrador para la administración).
3. `slug_delivery_validado.sql`: valida el link de pedidos (largo, reservados, único) y exige administración desbloqueada.
4. `auditoria_ampliar.sql`: registro de actividad más completo y sin errores silenciosos.
5. `limites_y_retencion.sql`: tope por IP a errores y analítica, Libro de Reclamaciones sin tope global, y borrado automático de datos viejos (pg_cron).

| Archivo | Para qué |
|---|---|
| `errores_app.sql`, `analitica_eventos.sql`, `libro_reclamaciones.sql` | Tablas de registro de errores, conteo de visitas y Libro de Reclamaciones |
| `registrar_venta_atomica.sql`, `anular_venta_atomica.sql`, `registrar_entrada_mercaderia.sql`, `dashboard_*.sql`, `serie_boleta_por_bodega.sql` | Funciones de ventas, entradas de mercadería (en una sola transacción) y reportes |
| `revocar_privilegios_anon.sql`, `revocar_ejecucion_funciones.sql` | Segunda capa de seguridad: quitan permisos a `anon` (hay `_REVERSA` de emergencia) |
| `indices_llaves_foraneas.sql` | Índices en llaves foráneas. Aplicado el 2026-10-27 |
| `probar_aislamiento_entre_negocios.sql` | Prueba (con ROLLBACK) de que un dueño no ve datos de otro negocio. Requiere dos negocios de prueba reales |
| `auditoria_seguridad_supabase.sql`, `auditoria_exportar_todo.sql`, `auditar_correos_con_acceso.sql` | Solo lectura: revisan políticas, permisos y quién tiene acceso. Conviene correr la primera después de cada cambio |

## Acceso y roles

- Los dueños entran **solo con Google**. El superadmin entra con correo y contraseña desde el login del POS.
- La administración (Dashboard, precios y costos, cajeros, proveedores, compras, combos, anular ventas, Mi Link) está protegida **en el servidor**: hay que desbloquearla con el PIN del perfil Dueño o Administrador (`autorizacion_por_rol.sql`). El dueño crea su PIN la primera vez justo después de iniciar sesión con Google. Si lo olvida, el superadmin usa «Restablecer PIN de administrador» en el panel.
- En Supabase → Authentication → Providers → Email, dejar activado **Confirm email**.
- Las librerías pesadas (Excel, PDF, lector de códigos, QR, confeti) van empaquetadas con la app y se bajan solo al usarlas; la CSP (`vercel.json`) ya no permite scripts de ningún CDN.

## Monitoreo de errores

Los errores no controlados del navegador (y las pantallas que se rompen al dibujarse) se guardan en la tabla `errores_app` y se ven en el **panel de superadmin → pestaña Errores**, agrupados con su conteo. También llegan ahí los fallos que la app le muestra a la persona (abrir turno, cobrar, registrar pagos, sincronizar ventas sin conexión): el lugar va entre corchetes al inicio, por ejemplo `[abrir turno] 42501 …`. Se ignoran los errores por falta de internet y por sesión vencida, y no se reportan más de 10 por sesión. No hay servicios externos. No se guardan correos, números largos ni IP. Para activarlo, ejecutar `errores_app.sql` una vez. Revisar la pestaña después de cada despliegue y cuando un cliente reporte un problema.

## Revertir un problema (rollback)

| Qué falla | Cómo revertir |
|---|---|
| Un commit rompió algo | `git revert <commit>` y `git push`. Vercel vuelve a desplegar solo (~2 min) |
| Un despliegue salió mal | Vercel → Deployments → el anterior → **Promote to Production** (~1 min) |
| Build o pruebas fallan | No hace falta nada: Vercel conserva la versión anterior |
| `revocar_privilegios_anon.sql` rompió un flujo | `grant select, insert, update, delete on public.<tabla> to anon;` en la tabla afectada |
| Otro SQL ya ejecutado | No tiene rollback automático: usar el backup de Supabase |

Señal para revertir primero y diagnosticar después: `/registro` o el login del POS falla, o las ventas no se guardan.

## Operación

- Los cobros se registran a mano en el panel de superadmin (Yape o enlace de pago de Izipay).
- Una caja abierta por más de 24 horas muestra un aviso para cerrarla.
- Texto de la interfaz en español, tuteo, "negocio" y "Tienda Virtual".
