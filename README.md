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

Los cambios de base de datos son archivos `.sql` en la raíz que se ejecutan **a mano** en el SQL Editor de Supabase. No hay migraciones automáticas. Casi todos son aditivos (crean tablas o funciones).

| Archivo | Para qué |
|---|---|
| `schema.sql`, `rls_*.sql`, `seguridad_*.sql` | Esquema base y políticas de seguridad por negocio |
| `errores_app.sql` | Registro de errores de la app (ver abajo) |
| `indices_llaves_foraneas.sql` | Índices en llaves foráneas (aviso del asesor de rendimiento de Supabase). Aplicado el 2026-10-27 |
| `probar_aislamiento_entre_negocios.sql` | Prueba (con ROLLBACK) de que un dueño no ve datos de otro negocio. Requiere dos negocios de prueba reales |
| `revocar_privilegios_anon.sql` | Opcional: quita permisos de tabla al rol `anon` (segunda capa de seguridad) |

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
