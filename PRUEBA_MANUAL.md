# Prueba manual del POS (recorrido de humo)

Para repetir **después de cada despliegue importante** (sobre todo si se tocó el arranque, el cobro, el turno o la caja). Dura unos 15 minutos. Se hace en producción con la cuenta **Bodega Demo**, nunca con el negocio de un cliente. No se anotan claves ni correos en este archivo.

Antes de empezar: espera a que Vercel marque el despliegue como **Ready** y recarga con Ctrl+F5.

## 0. Arranque

- [ ] El POS abre sin pantalla en blanco y muestra los productos.
- [ ] En la consola del navegador (F12) no hay errores nuevos en rojo.
- [ ] En la pestaña **Network → JS** se ven archivos `react-…` y `supabase-…` aparte.
- [ ] El menú ≡ muestra: Fiados, Historial, Clientes, Toma de Inventario, Registrar pérdida, y (como administrador) Dashboard, Cuentas por Pagar, Cajeros, Registro de actividad, Mi Link, Registrar Productos, Entrada de Mercadería, Combos, Manual de uso.

## 1. Turno

- [ ] **Abrir Turno** con S/ 100. Sale «Turno abierto» y el botón pasa a «Turno Abierto».
- [ ] Si falla, no debe quedar un mensaje confuso: una sesión vencida lleva al ingreso con un aviso.

## 2. Venta en efectivo

- [ ] Toca un producto dos veces y otro una vez. El total del carrito es la suma exacta.
- [ ] Los botones **+** y **−** del carrito cambian la cantidad y el total.
- [ ] **Cobrar → Efectivo → paga con un monto mayor**: el vuelto es `pagó − total`.
- [ ] **Cobrar e imprimir boleta**: sale «¡Venta exitosa!» con número de boleta, y el stock de esos productos bajó en la pantalla.

## 3. Combo y crédito

- [ ] En «Combos» agrega un combo: aparece una sola línea con el precio del combo.
- [ ] **Cobrar → Crédito → elegir cliente de prueba**: muestra «Disponible» del cliente y deja registrar.
- [ ] El historial muestra el combo desglosado en sus productos y su suma es el precio del combo.

## 4. Clientes y Fiados

- [ ] **Clientes**: el cliente de prueba aparece con la deuda nueva; «Por cobrar» es la suma de las deudas.
- [ ] Filtros «Todos / Con deuda / Al día» filtran bien. Abrir un cliente muestra deuda, disponible y límite.
- [ ] Cambiar el teléfono y **Guardar cambios** → «Cliente actualizado» y se ve en la lista y en Fiados.
- [ ] **Fiados**: abrir al cliente → **Registrar pago** por el total → «Pago registrado» y su deuda queda en S/ 0.00; «Total por cobrar» baja en ese monto.

## 5. Otras pantallas (abren y muestran datos)

- [ ] **Historial**: total del día = suma de las ventas hechas; pestaña «Cierres de caja» abre.
- [ ] **Dashboard**: venta total, utilidad, margen y productos más vendidos con datos.
- [ ] **Toma de Inventario**: buscar un producto lo encuentra. Cerrar sin guardar no cambia el stock.
- [ ] **Registrar pérdida**, **Registrar Productos** (al escribir «leche» sugiere productos de Kaserita), **Entrada de Mercadería** (filtro «Por reponer»), **Combos**, **Cuentas por Pagar**, **Cajeros**, **Registro de actividad**, **Mi Link de Pedidos**.

## 6. Cierre de caja

- [ ] **Cerrar Caja**: «Deberías tener» = fondo + ventas **en efectivo** (el crédito no cuenta).
- [ ] Escribir ese monto → «Cuadra perfecto». Escribir otro → muestra la diferencia.
- [ ] **Cerrar turno** → resumen del turno con diferencia S/ 0.00.

## 7. Al terminar

- [ ] En el panel de superadmin → pestaña **Errores**, revisar que no aparezcan fallos nuevos de `[abrir turno]`, `[Error al registrar venta]`, `[No se pudo registrar el pago]` u otros durante la prueba.
- [ ] Anotar fecha, quién la hizo y qué falló en el mensaje del commit o en el chat.

## Si algo falla

Sigue la tabla «Revertir un problema (rollback)» del README. Señal para **revertir primero**: el login falla, no se puede abrir turno, o las ventas no se guardan.
