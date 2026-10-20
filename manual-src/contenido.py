# -*- coding: utf-8 -*-
"""Contenido del manual de uso de Kaserita.

Estructura: GRUPOS = [(id, titulo, [temas])]
tema = dict(id, titulo, intro, bloques=[...])
bloque = ('fig', archivo, pie, [marcas], 'modal'|'movil')
       | ('pasos', [textos])
       | ('tip', texto) | ('aviso', texto) | ('p', texto) | ('lista', [textos])
"""

PRIMER_DIA = [
    ('registrar-productos', 'Registra tus productos', 'Créalos uno por uno o impórtalos del catálogo maestro.'),
    ('entrada-mercaderia', 'Carga el stock', 'Con una entrada de mercadería (o un levantamiento de inventario).'),
    ('abrir-turno', 'Abre tu turno', 'Indica con cuánto efectivo empiezas la caja.'),
    ('vender', 'Vende y cobra', 'Toca los productos, elige cómo paga el cliente y cobra.'),
    ('cerrar-caja', 'Cierra la caja', 'Cuenta el efectivo y mira si cuadra con el sistema.'),
    ('tienda-que-es', 'Activa tu tienda online', 'Opcional: tus clientes piden desde su celular.'),
]

GRUPOS = []

# ---------------------------------------------------------------- EMPIEZA AQUÍ
GRUPOS.append(('empieza', 'Empieza aquí', [
    dict(id='pantalla', titulo='La pantalla principal',
         intro='Es donde pasas casi todo el día: a la izquierda están tus productos y a la derecha el carrito de la venta que estás armando.',
         bloques=[
             ('fig', 'pos-pantalla-principal', 'Pantalla principal del POS', [
                 '<b>Abrir Turno.</b> Sin turno abierto no puedes cobrar. Cuando lo abres, el botón cambia a «Turno Abierto».',
                 '<b>Menú de opciones (≡).</b> Aquí están todos los módulos: stock, inventario, clientes, dashboard y más. Mira el tema «El menú de opciones».',
                 '<b>Categorías.</b> Filtra los productos por categoría (Abarrotes, Lácteos, Bebidas…).',
                 '<b>Combos.</b> Los paquetes de varios productos a precio especial. El número es cuántos combos activos tienes.',
                 '<b>Buscador.</b> Escribe el nombre o escanea el código de barras con un lector. La lupa busca y la campanilla abre «Pedidos por retirar» (tienda online).',
                 '<b>Carrito.</b> Aquí van apareciendo los productos que tocas. Cada fila trae su cantidad y su precio.',
                 '<b>Cobrar.</b> Pasa al pago. Mientras no haya turno abierto dice «Abre un turno para cobrar».',
                 '<b>En espera.</b> Las ventas que dejaste pausadas. El número indica cuántas hay.',
             ], 'modal'),
             ('p', 'Cada tarjeta de producto te cuenta algo de un vistazo:'),
             ('lista', [
                 '<b>«N disp.»</b> es el stock disponible. En ámbar («Quedan 4») significa que el stock está bajo; en rojo («Sin stock») que se acabó.',
                 '<b>La estrella morada ★</b> marca los productos destacados en tu tienda online.',
                 '<b>El regalo morado</b> indica que el producto forma parte de un combo.',
                 '<b>El lápiz</b> (aparece al pasar el mouse, o siempre en el celular) abre la ficha para editar el producto.',
             ]),
             ('fig', 'pos-categorias', 'Selector de categorías', [
                 '<b>Buscar categoría.</b> Escribe para encontrarla más rápido.',
                 '<b>TODOS.</b> Muestra todo tu catálogo. A la derecha ves cuántos productos hay en total.',
                 '<b>Cada categoría</b> con su número de productos. Tócala para ver solo esos.',
             ], 'modal'),
         ]),
    dict(id='menu', titulo='El menú de opciones (≡)',
         intro='Toca el botón ≡ de arriba para abrir el menú. Funciona como un buscador de comandos: escribe una palabra («stock», «cliente», «merma») y presiona Enter para ir directo. También puedes moverte con ↑ ↓ y cerrar con Esc.',
         bloques=[
             ('fig', 'pos-menu-mas-1', 'Menú de opciones, parte superior', [
                 '<b>Buscar una opción.</b> Escribe para filtrar el menú.',
                 '<b>Fiados.</b> Lo que te deben tus clientes a crédito.',
                 '<b>Historial.</b> Las boletas de hoy o de otras fechas; desde aquí también anulas una venta.',
                 '<b>Ver Stock.</b> Todo tu catálogo con sus cantidades. La insignia («2 por reponer») te avisa cuándo toca comprar.',
                 '<b>Toma de Inventario.</b> Cuenta lo que hay en el local y ajusta el sistema.',
                 '<b>Registrar Merma.</b> Productos vencidos, rotos o perdidos.',
             ], 'modal'),
             ('fig', 'pos-menu-mas-2', 'Menú de opciones, parte inferior', [
                 '<b>Cajeros y Empleados.</b> Quién puede entrar y con qué permisos.',
                 '<b>Registro de actividad.</b> Un historial de lo que se cambió y quién lo hizo.',
                 '<b>Mi Link de Pedidos.</b> Tu tienda online: logo, horario, entrega a domicilio y QR.',
                 '<b>Registrar Productos.</b> Crea o actualiza las fichas de tus productos.',
                 '<b>Entrada de Mercadería.</b> Registra tus compras: suma stock y actualiza el costo.',
                 '<b>Levantamiento de Inventario.</b> Cuenta producto por producto escaneando.',
                 '<b>Combos.</b> Crea paquetes a precio especial.',
                 '<b>Importar del Catálogo Maestro.</b> Agrega productos ya cargados con foto.',
                 '<b>Cambiar mi PIN.</b> Solo el dueño. La insignia «Recomendado» aparece mientras tu PIN no esté reforzado.',
                 '<b>Cerrar Sesión.</b> Sal del POS en ese equipo.',
             ], 'modal'),
             ('p', 'Arriba de todo, según tu caja, verás también «Abrir Turno» o «Cerrar Caja». Falta mostrar «Clientes», «Dashboard de Ventas» y «Cuentas por Pagar», que están en el mismo menú.'),
             ('aviso', 'No todos ven todas las opciones. Un <b>cajero</b> solo ve lo necesario para vender: caja, fiados, historial, clientes, ver stock, toma de inventario y merma. El <b>administrador</b> y el <b>dueño</b> ven además el dashboard, las entradas, los combos, los cajeros, el registro de actividad y Mi Link de Pedidos.'),
         ]),
]))

# ---------------------------------------------------------------- CAJA Y VENTAS
GRUPOS.append(('caja', 'Caja y ventas', [
    dict(id='abrir-turno', titulo='Abrir el turno de caja',
         intro='El turno es tu jornada de caja: todo lo que vendas queda registrado dentro de él. Ábrelo cada vez que empieces a atender.',
         bloques=[
             ('fig', 'caja-abrir-turno', 'Apertura de turno', [
                 '<b>Cajero.</b> Elige quién va a atender la caja.',
                 '<b>«+ No está en la lista, agregarlo».</b> Si es una persona nueva, créala en ese momento.',
                 '<b>Monto inicial.</b> El efectivo con el que empiezas la caja (el «sencillo»). Después se usa para cuadrar al cerrar.',
                 '<b>Confirmar y Abrir.</b> Listo: el botón de arriba pasa a «Turno Abierto» y ya puedes cobrar.',
             ], 'modal'),
             ('pasos', [
                 'Toca <b>Abrir Turno</b> (en el celular está dentro del menú ≡).',
                 'Elige el cajero y escribe el monto inicial.',
                 'Presiona <b>Confirmar y Abrir</b>.',
             ]),
             ('tip', 'Si ya había una caja abierta, el sistema la retoma en vez de crear otra.'),
         ]),
    dict(id='vender', titulo='Armar una venta',
         intro='Toca los productos que lleva el cliente. Se agregan al carrito de la derecha, con su precio y el total.',
         bloques=[
             ('fig', 'venta-carrito', 'Venta en curso con dos productos', [
                 '<b>Turno Abierto.</b> Indica que ya puedes cobrar.',
                 '<b>Producto agregado.</b> La tarjeta se pone verde con una marca ✓ y la cantidad que llevas.',
                 '<b>Buscador / lector.</b> También puedes escanear el código de barras: el producto entra solo al carrito.',
                 '<b>Línea del carrito.</b> Usa − y + para cambiar la cantidad que lleva el cliente.',
                 '<b>Pausar.</b> Guarda esta venta en «En espera» y deja el carrito libre para atender a otro cliente.',
                 '<b>Vaciar.</b> Borra todo el carrito (pide confirmación).',
                 '<b>Cobrar.</b> Pasa al pago.',
             ], 'modal'),
             ('tip', 'Para retomar una venta pausada, toca <b>En espera</b> (arriba a la derecha) y elige la venta.'),
         ]),
    dict(id='cobrar', titulo='Cobrar: efectivo, Yape, Plin, tarjeta o mixto',
         intro='Al tocar Cobrar, el carrito se convierte en el panel de pago. Elige cómo paga el cliente y emite la boleta.',
         bloques=[
             ('fig', 'venta-cobrar', 'Panel de pago en efectivo', [
                 '<b>Volver.</b> Regresa al carrito sin cobrar.',
                 '<b>Medio de pago.</b> Efectivo, Yape, Plin, Tarjeta, Crédito o Mixto.',
                 '<b>Paga con.</b> Escribe cuánto te entrega el cliente. El botón de la calculadora te ayuda a sumar billetes.',
                 '<b>Atajos.</b> «Exacto» pone justo el total; S/ 50, S/ 100 y S/ 200 son los billetes más comunes.',
                 '<b>Vuelto.</b> Se calcula solo. Es lo que debes devolver.',
                 '<b>Aplicar descuento.</b> Rebaja el total de esta venta.',
                 '<b>Total a cobrar.</b> Lo que el cliente debe pagar, ya con el descuento.',
                 '<b>Cobrar e imprimir boleta.</b> Registra la venta, descuenta el stock y emite la boleta.',
             ], 'modal'),
             ('p', '<b>Yape, Plin y tarjeta</b> funcionan igual: eliges el medio y cobras. No hay vuelto que calcular.'),
             ('fig', 'venta-mixto', 'Pago mixto', [
                 '<b>Monto en tarjeta / otro.</b> Lo que paga con tarjeta, Yape o Plin.',
                 '<b>Falta en efectivo.</b> Se calcula solo: el total menos lo que ya pagó con otro medio.',
                 '<b>Recibe en efectivo.</b> Lo que te entrega en billetes o monedas.',
                 '<b>Vuelto.</b> Se calcula con el efectivo recibido.',
             ], 'modal'),
             ('tip', 'Usa <b>Mixto</b> cuando el cliente paga una parte con efectivo y otra con Yape, Plin o tarjeta.'),
         ]),
    dict(id='credito', titulo='Vender a crédito (fiado)',
         intro='Para vender «al fiado» necesitas un cliente registrado. La venta queda como deuda hasta que te pague.',
         bloques=[
             ('fig', 'venta-elegir-cliente', 'Seleccionar cliente', [
                 '<b>Buscar.</b> Escribe el nombre o el DNI.',
                 '<b>Cliente Varios / Desconocido.</b> Para ventas sin cliente. No sirve para crédito.',
                 '<b>Un cliente de tu lista.</b> En rojo ves cuánto te debe hoy.',
                 '<b>+ Registrar cliente nuevo.</b> Lo creas al instante sin salir de la venta.',
             ], 'modal'),
             ('pasos', [
                 'En el panel de pago elige <b>Crédito</b>.',
                 'Si no hay cliente asignado, toca <b>Cambiar</b> y selecciónalo.',
                 'Revisa su límite de crédito y presiona <b>Registrar venta a crédito</b>.',
                 'Cuando el cliente venga a pagar, regístralo en <b>Fiados</b>.',
             ]),
         ]),
    dict(id='venta-exitosa', titulo='La boleta y qué hacer después',
         intro='Al cobrar aparece la confirmación con el número de boleta.',
         bloques=[
             ('fig', 'venta-exitosa', 'Venta exitosa', [
                 '<b>Número de boleta.</b> Es la serie de tu negocio y un correlativo (B001-00000023).',
                 '<b>Nueva venta.</b> Cierra esta pantalla y deja el carrito limpio para el siguiente cliente.',
                 '<b>Imprimir.</b> Imprime la boleta en tu impresora.',
                 '<b>WhatsApp.</b> Envía la boleta al cliente por WhatsApp.',
                 '<b>Ticketera Bluetooth.</b> Imprime en una ticketera conectada por Bluetooth.',
             ], 'modal'),
         ]),
    dict(id='historial', titulo='Historial de ventas y cómo anular una boleta',
         intro='Aquí ves todo lo que vendiste y puedes corregir errores. Anular devuelve los productos al stock.',
         bloques=[
             ('fig', 'historial', 'Historial de ventas', [
                 '<b>Ventas de hoy.</b> Las boletas del día.',
                 '<b>Cierres de caja.</b> Los turnos cerrados y cómo cuadraron.',
                 '<b>Desde / Hasta.</b> Cambia las fechas y presiona <b>Buscar</b>. «Hoy» regresa al día actual.',
                 '<b>Buscar y Excel.</b> Busca por número de boleta o descarga el reporte en Excel.',
                 '<b>Ganancia.</b> Cuánto ganaste en el rango (venta menos costo).',
                 '<b>Anular.</b> Cancela la boleta.',
                 '<b>Boleta.</b> Número, medio de pago, hora y cliente. La impresora vuelve a imprimirla.',
             ], 'modal'),
             ('fig', 'historial-anular', 'Confirmar la anulación', [
                 '<b>Aviso.</b> Anular no se puede deshacer.',
                 '<b>Cancelar.</b> Si te arrepientes.',
                 '<b>Sí, anular.</b> Continúa al siguiente paso.',
             ], 'modal'),
             ('fig', 'historial-motivo', 'Motivo de la anulación', [
                 '<b>Motivo.</b> Opcional, pero conviene escribirlo (queda en el registro de actividad).',
                 '<b>Cancelar.</b> Cierra sin anular.',
                 '<b>Anular boleta.</b> La boleta queda marcada como anulada, deja de sumar en tus totales y el stock vuelve al inventario.',
             ], 'modal'),
         ]),
    dict(id='cerrar-caja', titulo='Cerrar la caja (arqueo)',
         intro='Al terminar tu turno cuentas el efectivo y el sistema te dice si cuadra. Así detectas diferencias el mismo día.',
         bloques=[
             ('fig', 'caja-cerrar', 'Cierre de turno', [
                 '<b>Fondo inicial.</b> Con lo que abriste la caja.',
                 '<b>Ventas en efectivo.</b> Lo que cobraste en efectivo durante el turno (Yape, Plin y tarjeta no cuentan aquí).',
                 '<b>Deberías tener.</b> Fondo inicial + ventas en efectivo.',
                 '<b>Cuenta tu efectivo.</b> Cuenta los billetes y monedas de la caja y escribe el total. Debajo aparece «Cuadra perfecto» o la diferencia.',
                 '<b>Confirmar Cierre.</b> Cierra el turno.',
             ], 'modal'),
             ('fig', 'caja-resumen', 'Resumen del turno', [
                 '<b>Detalle.</b> Fondo, efectivo recibido, lo que debía haber y lo que contaste.',
                 '<b>Diferencia.</b> «Cuadre Perfecto» si coincide; si no, el monto que sobra o falta.',
                 '<b>Entendido.</b> Cierra el resumen.',
             ], 'modal'),
             ('pasos', [
                 'Abre el menú ≡ y elige <b>Cerrar Caja</b>.',
                 'Cuenta el efectivo que hay en la caja y escríbelo.',
                 'Presiona <b>Confirmar Cierre</b> y revisa el resumen.',
             ]),
             ('tip', 'Los cierres quedan guardados: los ves en <b>Historial → Cierres de caja</b> y en el <b>Registro de actividad</b>.'),
         ]),
]))

# ---------------------------------------------------------------- CLIENTES Y DEUDAS
GRUPOS.append(('clientes', 'Clientes y deudas', [
    dict(id='clientes', titulo='Clientes',
         intro='Registra a tus clientes frecuentes para venderles a crédito y llevar su deuda al día.',
         bloques=[
             ('fig', 'clientes-lista', 'Lista de clientes', [
                 '<b>Agregar Cliente.</b> Abre el formulario de registro.',
                 '<b>Buscador.</b> Por nombre o DNI.',
                 '<b>Cliente.</b> Su nombre y documentos.',
                 '<b>Debe.</b> En rojo, lo que te debe hoy. Si no debe nada, no aparece.',
                 '<b>Límite.</b> El máximo de crédito que le permites.',
             ], 'modal'),
             ('fig', 'clientes-nuevo', 'Registrar un cliente', [
                 '<b>DNI</b> (obligatorio).',
                 '<b>Nombre completo</b> (obligatorio).',
                 '<b>Teléfono.</b> Sirve para enviarle su estado de cuenta por WhatsApp.',
                 '<b>Correo</b> (opcional).',
                 '<b>Límite de crédito (S/).</b> Cuánto fiado le permites como máximo.',
                 '<b>Guardar Cliente.</b>',
             ], 'modal'),
         ]),
    dict(id='cuentas-cobrar', titulo='Fiados',
         intro='Aquí cobras las deudas de tus clientes: ves cuánto te deben, qué boletas están pendientes y registras sus pagos.',
         bloques=[
             ('fig', 'cobrar-lista', 'Total por cobrar', [
                 '<b>Total por cobrar.</b> La suma de lo que te deben todos tus clientes.',
                 '<b>Cliente con deuda.</b> Toca uno para ver su detalle.',
             ], 'modal'),
             ('fig', 'cobrar-detalle', 'Detalle de la deuda de un cliente', [
                 '<b>Todos los clientes.</b> Regresa a la lista.',
                 '<b>Deuda actual.</b> Lo que debe en total.',
                 '<b>Boletas pendientes.</b> El título de la sección.',
                 '<b>Detalle de cada boleta:</b> número, fecha, productos y monto.',
                 '<b>Descargar PDF.</b> Su estado de cuenta en PDF.',
                 '<b>Enviar por WhatsApp.</b> Le mandas su estado de cuenta (necesita teléfono registrado).',
                 '<b>Pagar todo / Mitad.</b> Rellenan el monto a abonar; también puedes escribir cualquier cantidad. Abajo ves el saldo que quedaría.',
                 '<b>Registrar pago de deuda.</b> Descuenta el abono de su deuda.',
             ], 'modal'),
         ]),
]))

# ---------------------------------------------------------------- PRODUCTOS E INVENTARIO
GRUPOS.append(('inventario', 'Productos e inventario', [
    dict(id='registrar-productos', titulo='Registrar productos',
         intro='Crea la ficha de cada producto: nombre, categoría, precio y forma de venta. La cantidad en stock se carga después desde «Entrada de Mercadería». Puedes crear varios productos seguidos antes de guardar.',
         bloques=[
             ('fig', 'prod-registrar-1', 'Registrar productos, identificación', [
                 '<b>Código de barras (EAN).</b> Escríbelo o toca «Escanear» para leerlo con la cámara. Es opcional, pero con él vendes escaneando.',
                 '<b>Foto del producto.</b> Con «Cámara» o «Galería». También puedes pegar una imagen copiada con Ctrl+V. La foto se ve en la tienda online.',
                 '<b>Descripción</b> (obligatoria). El nombre como lo verán tus clientes.',
                 '<b>Catálogo sugerido.</b> Busca el producto en el catálogo maestro y te rellena nombre, categoría y foto.',
                 '<b>Categoría.</b> Elige una de la lista o crea una nueva con el botón «+».',
             ], 'modal'),
             ('fig', 'prod-registrar-2', 'Registrar productos, precio y forma de venta', [
                 '<b>Precio de venta</b> por unidad (obligatorio).',
                 '<b>Precio de costo</b> por unidad. Opcional; con él el sistema calcula tus ganancias y márgenes.',
                 '<b>Se vende por.</b> Unidad (UND) o Peso (KG) si usas balanza.',
                 '<b>Vender también en pack o caja cerrada.</b> Para six-packs, displays o cajas con precio especial.',
                 '<b>SKU.</b> Tu código interno. Si lo dejas vacío, se genera solo.',
                 '<b>Agregar otro producto.</b> Suma otra ficha sin cerrar la ventana.',
                 '<b>Guardar Inventario.</b> Guarda todos los productos del formulario.',
             ], 'modal'),
         ]),
    dict(id='catalogo-maestro', titulo='Importar del catálogo maestro',
         intro='El catálogo maestro es una base de productos ya cargados con nombre, categoría y foto. Es la forma más rápida de armar tu inventario.',
         bloques=[
             ('fig', 'inv-catalogo-maestro', 'Buscar en el catálogo', [
                 '<b>Buscador.</b> Escribe parte del nombre.',
                 '<b>Resultado.</b> Toca el producto que quieres traer a tu inventario.',
             ], 'modal'),
             ('fig', 'inv-catalogo-importar', 'Importar un producto', [
                 '<b>Volver a la búsqueda.</b>',
                 '<b>El producto elegido</b>, con su foto y categoría.',
                 '<b>Precio de venta (S/).</b>',
                 '<b>Precio de costo (S/).</b>',
                 '<b>Stock inicial.</b> Cuántas unidades tienes ahora.',
                 '<b>Unidad.</b> Por unidad (UND) o por peso (KG).',
                 '<b>Código EAN</b> (opcional).',
                 '<b>Agregar a mi Inventario.</b>',
             ], 'modal'),
         ]),
    dict(id='editar-producto', titulo='Editar un producto',
         intro='Para cambiar un precio, corregir un nombre o destacar un producto en tu tienda online, toca el lápiz de su tarjeta.',
         bloques=[
             ('fig', 'prod-editar-1', 'Editar producto', [
                 '<b>Foto.</b> Toca el cuadro para cambiarla o pega una imagen con Ctrl+V.',
                 '<b>Destacar en Kaserita Delivery.</b> Activa esta casilla para que el producto salga en el carrusel de destacados de tu tienda online. Puedes marcar varios.',
                 '<b>Precio de venta</b> por unidad.',
                 '<b>Precio de costo.</b> Debajo se muestra el <b>margen %</b> y el precio que resultaría.',
                 '<b>Usar.</b> Aplica ese precio sugerido en un toque.',
                 '<b>Stock actual.</b> Corrígelo si hace falta.',
                 '<b>Descripción para la vitrina.</b> Texto extra que verán tus clientes en la tienda (talla, color, detalles).',
                 '<b>Fotos adicionales</b> para la vitrina (hasta 4).',
             ], 'modal'),
             ('p', 'Más abajo del formulario están también el código EAN, la categoría, la unidad, el pack o caja cerrada, el SKU y el botón <b>Guardar Cambios</b>. El botón rojo de abajo a la izquierda permite desactivar el producto.'),
         ]),
    dict(id='entrada-mercaderia', titulo='Entrada de mercadería (compras)',
         intro='Cada vez que llega mercadería, regístrala aquí: se suma al stock y se actualiza el costo de los productos.',
         bloques=[
             ('fig', 'inv-entrada', 'Entrada de mercadería', [
                 '<b>Proveedor.</b> De quién compraste.',
                 '<b>N° de factura o guía.</b> Si lo dejas vacío, el sistema le pone uno.',
                 '<b>Producto.</b> Elígelo de la lista (o crea uno nuevo con «+ Nuevo producto…»).',
                 '<b>Cantidad</b> que llegó.',
                 '<b>Costo unitario</b> al que te lo vendieron.',
                 '<b>+ Añadir.</b> Suma el producto a la compra. Repite con cada producto.',
                 '<b>Detalle.</b> Cada línea con su subtotal; la papelera la quita.',
                 '<b>Total de la compra.</b>',
                 '<b>Confirmar Entrada de Mercadería.</b> Guarda la compra y actualiza el stock.',
             ], 'modal'),
         ]),
    dict(id='ver-stock', titulo='Ver stock',
         intro='Tu catálogo completo con las cantidades. Es la mejor forma de saber qué reponer.',
         bloques=[
             ('fig', 'inv-ver-stock', 'Ver stock', [
                 '<b>Buscador.</b> Por nombre de producto.',
                 '<b>Categorías.</b> Filtra por una categoría.',
                 '<b>Filtros.</b> «Todos», «Stock bajo» (cerca del mínimo) y «Sin stock».',
                 '<b>Cada producto</b> muestra su categoría, su <b>mínimo</b> y la cantidad actual. En ámbar, el stock está bajo.',
             ], 'modal'),
             ('tip', 'En el menú ≡, la opción «Ver Stock» muestra una insignia («2 por reponer») cuando hay productos bajo el mínimo.'),
         ]),
    dict(id='toma-inventario', titulo='Toma de inventario',
         intro='Para comprobar que lo que dice el sistema coincide con lo que realmente hay. Se hace en dos pasos: contar y revisar.',
         bloques=[
             ('fig', 'inv-toma', 'Toma de inventario, paso 1: contar', [
                 '<b>Nueva toma.</b> Empieza un conteo.',
                 '<b>Historial.</b> Tus tomas anteriores.',
                 '<b>Buscar o escanear.</b> Escribe el nombre, escanea el código o usa la cámara.',
                 '<b>Producto contado.</b> Escribe los <b>packs</b>, cuántas unidades trae cada pack y las <b>sueltas</b>. Abajo ve el total.',
                 '<b>Agregar.</b> Suma lo contado. Si el producto está en dos lugares del local, cuenta cada uno y se va sumando.',
                 '<b>Continuar a Revisión.</b> Pasa al paso 2.',
             ], 'modal'),
             ('pasos', [
                 'Busca o escanea un producto, escribe lo que encuentras y presiona <b>Agregar</b>.',
                 'Repite con todos los productos que quieras verificar.',
                 'Presiona <b>Continuar a Revisión</b>: verás lo que dice el sistema frente a lo que contaste.',
                 'Confirma: el stock de los productos con diferencia se ajusta al número contado.',
             ]),
             ('tip', 'Si cierras la ventana a mitad del conteo, no pierdes nada: al volver se restaura lo que ya habías contado. «Vaciar» borra el conteo.'),
         ]),
    dict(id='levantamiento', titulo='Levantamiento de inventario',
         intro='Una forma rápida de fijar el stock producto por producto, con lector de código de barras. Es ideal para cargar tu inventario inicial.',
         bloques=[
             ('fig', 'inv-levantamiento', 'Levantamiento de inventario', [
                 '<b>Escanea o escribe el EAN.</b> El campo ya está listo para recibir el lector. También hay un botón de cámara.',
                 '<b>Buscar.</b> Si el código no existe, te avisa que primero lo registres en «Registrar Productos».',
             ], 'modal'),
             ('pasos', [
                 'Escanea el producto. Aparece su nombre con «Producto encontrado».',
                 'Escribe los <b>packs contados</b> y las <b>unidades sueltas</b>; el sistema suma el total.',
                 'Presiona <b>Guardar y escanear siguiente</b>: se guarda el conteo y quedas listo para el próximo producto.',
             ]),
         ]),
    dict(id='merma', titulo='Registrar una merma',
         intro='Merma es lo que pierdes sin vender: productos vencidos, rotos, robados o perdidos. Registrarla mantiene tu stock real.',
         bloques=[
             ('fig', 'inv-merma', 'Registrar merma', [
                 '<b>Producto.</b> Búscalo por nombre o escanéalo. Verás su stock actual.',
                 '<b>Cambiar.</b> Elige otro producto.',
                 '<b>Cantidad</b> que se perdió.',
                 '<b>Costo perdido.</b> Se calcula solo con el costo del producto.',
                 '<b>Motivo.</b> Vencido, Roto/Dañado, Robo/Pérdida u Otro.',
                 '<b>El stock quedará en…</b> Te muestra cómo quedará el inventario antes de confirmar.',
                 '<b>Registrar merma.</b> Descuenta el stock y deja constancia.',
             ], 'modal'),
         ]),
    dict(id='combos', titulo='Combos',
         intro='Un combo es un paquete de varios productos a un precio especial (por ejemplo, desayuno = pan + leche + huevos). Al venderlo, se descuenta el stock de cada producto que lo compone.',
         bloques=[
             ('fig', 'combos-lista', 'Lista de combos', [
                 '<b>Nuevo Combo.</b>',
                 '<b>Cada combo</b> muestra cuántos productos tiene, su precio, tu ganancia y el margen. Si el margen es bajo, te lo avisa «(bajo)».',
                 '<b>Interruptor.</b> Activa o apaga el combo. Un combo apagado no se puede vender ni se ve en la tienda.',
                 '<b>Lápiz.</b> Edita el combo.',
                 '<b>Papelera.</b> Lo elimina.',
             ], 'modal'),
             ('fig', 'combos-nuevo', 'Crear un combo', [
                 '<b>Nombre del combo</b> (obligatorio).',
                 '<b>Descripción</b> (opcional).',
                 '<b>Productos.</b> Busca y agrega cada producto; ajusta cuántas unidades lleva.',
                 '<b>Precio del combo.</b> Al lado ves el precio sumado de los productos por separado y el ahorro del cliente.',
                 '<b>Descuento rápido.</b> −5 %, −10 % o −15 % sobre el precio sumado.',
                 '<b>Ganancia por combo.</b> Cuánto ganas y qué margen deja. Verde si es sano.',
                 '<b>Combo activo.</b> Visible para vender.',
                 '<b>Guardar Combo.</b>',
             ], 'modal'),
             ('fig', 'pos-combos', 'Vender un combo en el POS', [
                 '<b>Pestaña Combos.</b> Muestra todos tus combos activos.',
                 '<b>Tarjeta del combo.</b> Precio y lo que incluye. Tócala para agregarlo.',
                 '<b>En el carrito</b> entra como una sola línea: «Combo: Combo Desayuno».',
                 '<b>Cobrar.</b> Como cualquier venta; el stock baja producto por producto.',
             ], 'modal'),
             ('tip', 'Para volver a ver todos los productos, toca de nuevo la pestaña Combos o elige «TODOS» en las categorías.'),
         ]),
]))

# ---------------------------------------------------------------- NEGOCIO Y CONTROL
GRUPOS.append(('negocio', 'Negocio y control', [
    dict(id='dashboard', titulo='Dashboard de ventas',
         intro='Tu tablero para entender cómo va el negocio: cuánto vendes, cuánto ganas, qué se vende más y a qué hora. Elige un rango de fechas y todo se actualiza.',
         bloques=[
             ('fig', 'dash-1', 'Dashboard: métricas del período', [
                 '<b>Desde / Hasta.</b> Escoge las fechas y presiona Buscar.',
                 '<b>Rangos rápidos.</b> Hoy, Últimos 7 días o Este mes.',
                 '<b>Excel.</b> Descarga el reporte del período.',
                 '<b>Métricas.</b> Utilidad (lo que ganas), costo, margen % y ticket promedio (lo que gasta cada cliente en promedio).',
                 '<b>Venta total</b> del período y cuánto subió o bajó frente al período anterior. El gráfico muestra las ventas por hora.',
                 '<b>Hora pico.</b> A qué hora vendes más.',
                 '<b>Métodos de pago.</b> Cómo pagan tus clientes (efectivo, Yape, tarjeta, crédito…).',
                 '<b>Productos más vendidos.</b> Ordenados por monto, con unidades y utilidad.',
             ], 'modal'),
             ('fig', 'dash-2', 'Dashboard: combos y ventas por día', [
                 '<b>Combos vendidos.</b> Unidades, ventas y ganancia de cada combo.',
                 '<b>Ventas por día.</b> Toca un día del calendario para ver su detalle.',
                 '<b>Indicadores del mes.</b> Promedio diario, día de mayor y de menor venta y días sin ventas.',
             ], 'modal'),
             ('fig', 'dash-4', 'Calendario de ventas', [
                 '<b>Mes.</b> Navega con las flechas entre meses.',
                 '<b>▲ Mejor día.</b> Cuanto más oscuro el color, más vendiste.',
                 '<b>▼ Día más flojo.</b> Te ayuda a ver cuándo conviene hacer una promoción.',
             ], 'modal'),
             ('fig', 'dash-3', 'Ventas por mes y deudas', [
                 '<b>Ventas por mes.</b> Todo el año de un vistazo, con tu mejor mes y el promedio.',
                 '<b>Fiados.</b> Lo que te deben tus clientes y quiénes son.',
                 '<b>Cuentas por pagar.</b> Lo que debes a tus proveedores.',
             ], 'modal'),
         ]),
    dict(id='cuentas-pagar', titulo='Cuentas por pagar (proveedores)',
         intro='Lleva la cuenta de lo que le debes a tus proveedores y registra tus pagos.',
         bloques=[
             ('fig', 'pagar-lista', 'Proveedores', [
                 '<b>Proveedor.</b> Toca uno para ver su detalle.',
                 '<b>Saldo.</b> En rojo, lo que le debes; en verde, si estás al día.',
                 '<b>Nuevo Proveedor.</b>',
             ], 'modal'),
             ('fig', 'pagar-nuevo', 'Nuevo proveedor', [
                 '<b>Nombre</b> (obligatorio).',
                 '<b>RUC.</b>',
                 '<b>Teléfono.</b>',
                 '<b>Deuda inicial</b> (opcional): si ya le debes algo hoy.',
                 '<b>Guardar Proveedor.</b>',
             ], 'modal'),
             ('p', 'Al tocar un proveedor ves «Le debemos: S/ …», escribes un monto y eliges <b>Agregar Deuda</b> (compraste a crédito) o <b>Registrar Pago</b> (le pagaste).'),
         ]),
    dict(id='cajeros', titulo='Cajeros y empleados',
         intro='Da acceso a tu equipo y decide qué puede hacer cada persona.',
         bloques=[
             ('fig', 'cajeros-lista', 'Lista de personas', [
                 '<b>Agregar Nuevo Cajero.</b>',
                 '<b>Reactivar.</b> Las personas dadas de baja aparecen como «Inactivo» y puedes volver a activarlas.',
                 '<b>El dueño</b> siempre aparece en la lista.',
             ], 'modal'),
             ('fig', 'cajeros-nuevo', 'Agregar una persona', [
                 '<b>Nombre.</b>',
                 '<b>DNI.</b>',
                 '<b>Rol.</b> <i>Cajero</i> solo vende y cobra. <i>Administrador</i> tiene acceso completo.',
                 '<b>Agregar.</b>',
             ], 'modal'),
         ]),
    dict(id='actividad', titulo='Registro de actividad',
         intro='Un historial de lo importante que pasa en tu negocio: quién cambió un precio, quién anuló una venta, cuándo se abrió o cerró cada turno.',
         bloques=[
             ('fig', 'auditoria', 'Registro de actividad', [
                 '<b>Filtros.</b> Todo, Precios y productos, Ventas, Turnos, Empleados o Mermas.',
                 '<b>Cada movimiento</b> muestra qué cambió (antes → después), cuándo y en qué turno. Aquí, una venta anulada con su motivo.',
                 '<b>Cierres de turno</b> con la diferencia y el efectivo contado.',
             ], 'modal'),
         ]),
    dict(id='pin', titulo='Cambiar mi PIN',
         intro='Solo el dueño tiene PIN de acceso. Cámbialo de vez en cuando y no lo compartas.',
         bloques=[
             ('pasos', [
                 'Abre el menú ≡ y, en la sección <b>Cuenta</b>, elige <b>Cambiar mi PIN</b>.',
                 'Escribe tu PIN actual y luego el nuevo, dos veces.',
                 'Guarda. Si ves la insignia «Recomendado», es que tu PIN todavía se puede reforzar.',
             ]),
         ]),
]))

# ---------------------------------------------------------------- TIENDA ONLINE
GRUPOS.append(('tienda', 'Tu tienda online (Mi link de pedidos)', [
    dict(id='tienda-que-es', titulo='Qué es y cómo funciona',
         intro='Tu tienda online es una vitrina en el celular de tus clientes. Entran con tu link o tu código QR, ven tus productos, arman su pedido y tú lo recibes directo en el POS.',
         bloques=[
             ('pasos', [
                 '<b>Configuras tu tienda</b> en el menú ≡ → <b>Mi Link de Pedidos</b>: logo, dirección, horario y, si quieres, entrega a domicilio.',
                 '<b>Compartes tu link</b> (delivery.smartdeskapps.com/tu-tienda) o imprimes tu QR en el mostrador.',
                 '<b>El cliente pide.</b> Elige productos, decide si recoge o quiere delivery y confirma con su cuenta de Google.',
                 '<b>Te llega el pedido</b> a <b>Pedidos por retirar</b> en el POS y el cliente puede avisarte por WhatsApp.',
                 '<b>Lo preparas</b> y lo marcas como listo: el cliente recibe el aviso.',
                 '<b>Lo cobras</b> cargándolo al carrito, como una venta normal.',
             ]),
             ('aviso', '<b>Es una función aparte de tu plan.</b> Si al abrir «Mi Link de Pedidos» ves «Función no habilitada», contacta al administrador de Kaserita para activarla en tu bodega.'),
             ('tip', 'Tus productos, precios, stock, categorías y combos son los mismos del POS. No tienes que cargar nada dos veces: lo que cambias en el POS se refleja en la tienda.'),
         ]),
    dict(id='tienda-configurar', titulo='Configurar tu tienda',
         intro='Abre el menú ≡ y elige Mi Link de Pedidos. Todo se guarda con el botón Guardar de abajo.',
         bloques=[
             ('fig', 'link-1', 'Mi link de pedidos: vitrina y horario', [
                 '<b>Logo.</b> Toca el círculo para subir o cambiar el logo que ven tus clientes.',
                 '<b>Aparecer en el catálogo público.</b> Encendido: tu tienda es visible para todos. Apagado: queda oculta y solo entra quien tenga tu link.',
                 '<b>Tu link.</b> Es fijo (ya se comparte impreso y en QR, por eso no cambia). Toca «Copiar» para pegarlo en WhatsApp o redes.',
                 '<b>Dirección de tu negocio.</b> Así saben de dónde les mandas el pedido o dónde recogerlo.',
                 '<b>Días de atención.</b> Marca los días que abres (Lu a Do).',
                 '<b>Horario.</b> De qué hora a qué hora atiendes. La tienda muestra «Abierto» o «Cerrado» en tiempo real. Si no lo configuras, no se muestra ningún aviso.',
             ], 'modal'),
             ('fig', 'link-2', 'Mi link de pedidos: entrega a domicilio', [
                 '<b>Llevar pedidos a domicilio.</b> Actívalo si haces delivery. El cliente marca su ubicación en un mapa y tú se la reenvías a tu repartidor.',
                 '<b>Costo de envío.</b> Lo que cobras por el delivery (S/ 4 en el ejemplo).',
                 '<b>Pedido mínimo.</b> El monto mínimo para aceptar un pedido a domicilio.',
                 '<b>Zona de reparto.</b> Los distritos o barrios que cubres. Se le muestra al cliente antes de pedir.',
                 '<b>WhatsApp de tu repartidor</b> (opcional). Con el código de país (51…). Si lo dejas vacío, WhatsApp te deja elegir el contacto cada vez. Tus clientes no ven este número.',
             ], 'modal'),
             ('fig', 'link-3', 'Mi link de pedidos: avisos y tu WhatsApp', [
                 '<b>Avisar a tus clientes.</b> Puedes mandar una notificación a quienes siguen o visitaron tu tienda.',
                 '<b>Avisar ahora.</b> Envía «¡Tu bodega ya recibe pedidos!». Se manda solo a quienes tienen los avisos activados y como máximo una vez por semana. Además, el aviso sale solo cuando activas tu catálogo o la entrega a domicilio.',
                 '<b>Tu número de WhatsApp.</b> Ahí te llegan los pedidos. Sin espacios ni guiones y con el código de país adelante. Solo lo cambia el dueño.',
                 '<b>Ver QR.</b> Muestra tu código QR.',
                 '<b>Guardar.</b> Aplica todos los cambios.',
             ], 'modal'),
         ]),
    dict(id='tienda-qr', titulo='Tu código QR',
         intro='Con «Ver QR» tus clientes entran a tu tienda con solo apuntar la cámara de su celular. Imprímelo y pégalo en el mostrador, la puerta o tus bolsas.',
         bloques=[
             ('fig', 'link-qr', 'Código QR de la tienda', [], 'modal'),
             ('tip', 'El QR y el link no cambian nunca, así que puedes imprimirlos sin miedo. Si tu dispositivo lo permite, el botón «Compartir» envía el link directo a tus contactos.'),
         ]),
    dict(id='tienda-destacados', titulo='Destacados: los productos estrella de tu tienda',
         intro='Los destacados salen arriba, en un carrusel, apenas el cliente abre tu tienda. Úsalos para lo que más quieres vender: ofertas, novedades o lo que más rota.',
         bloques=[
             ('pasos', [
                 'En el POS, ubica el producto y toca el <b>lápiz</b> de su tarjeta.',
                 'Activa <b>«Destacar en Kaserita Delivery»</b>.',
                 'Presiona <b>Guardar Cambios</b>. En el POS verás una <b>estrella ★</b> en su tarjeta.',
                 'Para quitarlo, repite el proceso y desmarca la casilla.',
             ]),
             ('fig', 'tienda-destacados', 'Todos los destacados, en la tienda', [
                 '<b>Todos los destacados.</b> El cliente toca «Ver todos» en el carrusel y ve la lista completa.',
                 '<b>Cada destacado</b> tiene su foto, precio y botón «+» para agregarlo al pedido.',
             ], 'movil'),
             ('aviso', 'Para que un producto aparezca en destacados <b>debe tener foto</b>. Si lo marcas y no sale, revisa que tenga imagen.'),
             ('tip', 'Puedes marcar varios productos. Conviene elegir entre 4 y 8 para que el carrusel se vea ordenado.'),
         ]),
    dict(id='tienda-combos', titulo='Combos y categorías en la tienda',
         intro='Tus combos activos aparecen en la tienda como «Combos con descuento», con el porcentaje que ahorra el cliente y el precio tachado.',
         bloques=[
             ('lista', [
                 'El <b>descuento</b> (por ejemplo −12 %) lo calcula el sistema: compara el precio del combo con la suma de los productos por separado.',
                 'Si apagas un combo en el POS (interruptor de «Combos»), deja de verse en la tienda.',
                 'Las <b>categorías</b> de la tienda son las mismas que usas en el POS: cuida que tus productos estén bien clasificados.',
                 'Los productos <b>sin stock</b> no se pueden pedir: se muestran aparte, en «Agotados por ahora». Mantén tu inventario al día con «Entrada de Mercadería» y «Toma de Inventario».',
             ]),
         ]),
    dict(id='tienda-cliente', titulo='Cómo ve y cómo pide tu cliente',
         intro='Así se ve tu tienda en el celular de tus clientes. Es útil que conozcas el recorrido para poder ayudarlos.',
         bloques=[
             ('fig', 'tienda-inicio', 'Inicio de la tienda', [
                 '<b>Logo y nombre.</b> El que configuraste en Mi Link de Pedidos.',
                 '<b>Abierto / Cerrado.</b> Según el horario que pusiste.',
                 '<b>Dirección</b> de tu negocio.',
                 '<b>Corazón.</b> El cliente sigue tu tienda y puede recibir avisos.',
                 '<b>Ingresar.</b> Entra con su cuenta de Google para ver sus pedidos.',
                 '<b>Buscador</b> de productos.',
                 '<b>Categorías.</b> Deslizan hacia los lados.',
                 '<b>Combos con descuento.</b> Con «Agregar +» los suma al pedido.',
                 '<b>Destacados.</b> Tus productos estrella.',
             ], 'movil'),
             ('fig', 'tienda-productos', 'Productos de la tienda', [
                 '<b>Buscador</b> fijo arriba mientras bajan.',
                 '<b>Categorías</b> siempre a la mano.',
                 '<b>Tarjeta de producto.</b> Tocar la foto la agranda.',
                 '<b>Corazón.</b> Guarda el producto como favorito.',
                 '<b>Botón «+».</b> Agrega el producto al pedido.',
             ], 'movil'),
             ('fig', 'tienda-agregar', 'Armando el pedido', [
                 '<b>Cantidad.</b> Al agregar, el «+» se convierte en un contador con − y +.',
                 '<b>Mi pedido.</b> Una barra siempre visible con la cantidad de productos y el total.',
                 '<b>Ver pedido.</b> Abre el resumen.',
             ], 'movil'),
             ('fig', 'tienda-pedido-retiro', 'Resumen del pedido: retiro en tienda', [
                 '<b>Vaciar.</b> Quita todos los productos (pide confirmación).',
                 '<b>Delivery / Retiro.</b> El cliente decide. Retiro es gratis; el delivery muestra su costo (si lo activaste).',
                 '<b>Retiras en.</b> Tu nombre y dirección, con «Ver mapa».',
                 '<b>Lo antes posible.</b> «Te avisamos cuando esté listo».',
                 '<b>Pagas en caja.</b> Efectivo, Yape o tarjeta, cuando recoja.',
                 '<b>Agregar más.</b> Vuelve a la tienda sin perder el pedido.',
                 '<b>Resumen y total.</b> Productos y total a pagar.',
                 '<b>Continuar con Google.</b> Para confirmar, el cliente entra con su cuenta de Google. No necesita crear ni recordar ninguna clave.',
             ], 'movil'),
             ('fig', 'tienda-pedido-delivery', 'Resumen del pedido: delivery', [
                 '<b>Delivery.</b> Muestra el costo de envío (S/ 4 en el ejemplo).',
                 '<b>Marcar.</b> El cliente indica dónde te lo llevas (ver el mapa a continuación).',
                 '<b>Forma de pago.</b> En delivery paga al recibir: efectivo, Yape/Plin o tarjeta. Si es efectivo, indica con cuánto paga para que lleves el vuelto.',
                 '<b>Envío a domicilio.</b> Se suma al total.',
                 '<b>Aviso.</b> El cliente no puede continuar hasta marcar su ubicación.',
             ], 'movil'),
             ('fig', 'tienda-pedido-domicilio', 'Marcar la ubicación de entrega', [
                 '<b>Mapa.</b> El cliente toca el mapa o arrastra el pin hasta el punto exacto.',
                 '<b>Usar mi ubicación.</b> Toma su ubicación actual.',
                 '<b>Referencia.</b> Un dato para encontrarlo: portón verde, 2.° piso, tocar timbre.',
                 '<b>Teléfono de contacto.</b> Para que el repartidor lo llame.',
                 '<b>Pedido mínimo.</b> El monto mínimo que configuraste.',
                 '<b>Confirmar dirección.</b> Se activa cuando todo está completo.',
             ], 'movil'),
             ('fig', 'tienda-ingresar', 'Ingresar con Google', [
                 '<b>Para qué sirve la cuenta:</b> ver el estado de sus pedidos, guardar sus tiendas favoritas y recibir un aviso cuando su pedido esté listo.',
                 '<b>Continuar con Google.</b> Un toque, sin contraseñas.',
             ], 'movil'),
             ('p', 'Al confirmar, el cliente ve <b>«¡Pedido registrado!»</b> con su <b>código del pedido</b> y el botón <b>«Enviar por WhatsApp»</b>: el mensaje llega a tu número y lleva el detalle (y la ubicación, si es delivery). Después puede seguir su pedido en la pestaña <b>Pedidos</b> de la tienda.'),
         ]),
    dict(id='tienda-recibir', titulo='Recibir, preparar y cobrar los pedidos',
         intro='Todos los pedidos de tu tienda llegan a «Pedidos por retirar», en el POS. Ahí los preparas y los cobras sin volver a escribir nada.',
         bloques=[
             ('fig', 'pedidos-retirar', 'Pedidos por retirar', [
                 '<b>Campanilla de mostrador.</b> Es el botón que está junto al buscador. Abre la lista de pedidos de la tienda.',
                 '<b>Encabezado.</b> Para volver al carrito, toca la flecha o la pestaña «Carrito».',
                 '<b>Pendientes · Listos para entrega · Historial.</b> El recorrido de un pedido de principio a fin. «Pendientes» y «Listos» muestran cuántos pedidos hay.',
                 '<b>Lista.</b> Cada pedido aparece como una tarjeta. Aquí no hay ninguno.',
             ], 'modal'),
             ('p', 'Cada pedido muestra el nombre del cliente (o su código), cuánto hace que llegó, los productos con sus montos y el total. Si es <b>a domicilio</b>, además ves el costo de envío, la referencia, el teléfono y cómo va a pagar (con cuánto y cuánto vuelto).'),
             ('pasos', [
                 '<b>Pendiente.</b> El pedido acaba de llegar. Arma los productos.',
                 'Cuando esté armado, toca <b>Marcar listo</b>. El cliente recibe el aviso.',
                 'Cuando el cliente llega (o para cobrar), toca <b>Cargar al carrito</b>: los productos pasan al carrito, los combos como combos.',
                 'Cobra como cualquier venta (necesitas el turno abierto). Al cobrar, el pedido se cierra solo y pasa al <b>Historial</b> como «Entregado».',
             ]),
             ('p', '<b>Si es a domicilio</b>, la tarjeta trae más botones: <b>Enviar al repartidor</b> (te abre WhatsApp con el pedido y la ubicación), <b>Ver mapa</b> (la ubicación en Google Maps) y <b>Marcar en camino</b> (el cliente ve que ya salió).'),
             ('lista', [
                 'En <b>Historial</b> puedes filtrar por <b>Hoy</b>, <b>7 días</b>, <b>30 días</b> o <b>Todos</b>.',
                 'Un pedido pendiente por más de 2 horas aparece como <b>«sin retirar»</b>: probablemente el cliente ya no vendrá.',
                 'Mientras un pedido está pendiente, <b>reserva stock</b> hasta 2 horas, para que no se lo vendas a otra persona. Pasado ese tiempo, el stock vuelve a estar disponible.',
                 'Si ya cargaste el pedido al carrito, el botón principal cambia a <b>Confirmar retiro</b> (o <b>Confirmar entrega</b> en delivery).',
             ]),
         ]),
]))

# ---------------------------------------------------------------- PREGUNTAS
FAQ = [
    ('No me deja cobrar', 'Casi siempre es porque no hay un turno abierto. Toca «Abrir Turno», elige el cajero y confirma el monto inicial. Mientras no haya turno, el botón dice «Abre un turno para cobrar».'),
    ('Me equivoqué en una venta, ¿qué hago?', 'Ve a <b>≡ → Historial</b>, busca la boleta y toca <b>Anular</b>. Escribe el motivo y confirma: la boleta queda anulada, deja de sumar en tus totales y los productos vuelven al stock.'),
    ('La caja no cuadra al cerrar', 'Revisa que contaste solo el <b>efectivo</b> (Yape, Plin y tarjeta no entran en el arqueo) y que no hay ventas anuladas o vueltos mal dados. La diferencia queda registrada en el cierre y en el Registro de actividad.'),
    ('Se cayó el internet, ¿puedo seguir vendiendo?', 'Si el POS ya estaba abierto cuando se cayó la conexión, puede seguir registrando ventas y las sincroniza cuando vuelve internet. Después revisa «Ver Stock» por si alguna cantidad necesita ajuste.'),
    ('Mi cajero no ve algunas opciones', 'Es normal: el rol <b>Cajero</b> solo ve lo necesario para vender. Para darle más acceso, cámbialo a <b>Administrador</b> en «Cajeros y Empleados».'),
    ('Mi tienda online no aparece o está vacía', 'Revisa en «Mi Link de Pedidos» que <b>«Aparecer en el catálogo público»</b> esté encendido y que hayas presionado <b>Guardar</b>. Recuerda que los productos sin stock se muestran aparte, como «Agotados por ahora», y no se pueden pedir. Si ves «Función no habilitada», pide que la activen en tu bodega.'),
    ('Marqué un destacado pero no sale', 'El producto necesita tener <b>foto</b>. Agrégale una desde el lápiz de su tarjeta y guarda.'),
    ('¿Puedo cambiar el link de mi tienda?', 'No. El link es fijo para que los QR y los afiches que ya imprimiste sigan funcionando.'),
    ('¿Cómo sé qué productos reponer?', 'Abre <b>≡ → Ver Stock</b> y usa el filtro «Stock bajo»: son los que están cerca o por debajo del mínimo. También lo ves en la insignia del menú («2 por reponer»).'),
    ('¿Dónde veo cuánto estoy ganando?', 'En <b>≡ → Dashboard de Ventas</b> (opción de administración). Muestra la utilidad, el costo y el margen del período que elijas.'),
    ('Un cliente quiere pagar su deuda', 'Abre <b>≡ → Fiados</b>, toca al cliente y registra su pago. Puede abonar una parte o todo («Pagar todo» / «Mitad»).'),
]
