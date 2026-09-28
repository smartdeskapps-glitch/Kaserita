import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  asegurarXLSX, generarSKU, fechaISOLocal, fechaHoyISO, comprimirImagenJPEG,
  formatearBytes, PIN_MAX, PIN_MIN_DUENO, pinValido, CATEGORIAS_FALLBACK,
  normalizarCategoria, CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO, CATEGORIA_ALIAS,
  categoriaDesdeTexto, FotoProducto, MiniInterruptor,
} from './PanelAdminCompartido.jsx';

// Panel del super-administrador: crea bodegas (el unico lugar donde se
// puede crear una, ver panel_admin.sql) y controla su vigencia. No usa
// "sesion" (esa es la de dueno/cajero de una bodega) -- entra con su
// propia cuenta de correo+contrasena de Supabase Auth.
//
// Vive en su propio archivo (separado de src/main.jsx) para que React lo
// cargue con lazy()/import() solo cuando adminSesion existe -- un cajero
// comun nunca descarga este codigo.
    export default function PanelAdmin({
      adminSesion, sbClient, bodegasAdmin, setBodegasAdmin, cargandoBodegasAdmin, setCargandoBodegasAdmin,
      formNuevaBodega, setFormNuevaBodega, guardandoNuevaBodega, setGuardandoNuevaBodega, notificar, toast, onCerrarSesion
    }) {
      const cargarBodegas = useCallback(async () => {
        setCargandoBodegasAdmin(true);
        try {
          const { data: bodegas, error } = await sbClient.from('bodegas').select('*').order('nombre');
          if (error) throw error;
          const { data: duenos } = await sbClient.from('usuarios').select('id, bodega_id, nombre, dni, email, auth_id, telefono').eq('rol', 'dueno');
          const duenoPorBodega = new Map((duenos || []).map((d) => [d.bodega_id, d]));
          setBodegasAdmin((bodegas || []).map((b) => ({ ...b, dueno: duenoPorBodega.get(b.id) || null })));
        } catch (err) {
          notificar(`No se pudo cargar la lista de bodegas: ${err.message}`, 'error');
        } finally {
          setCargandoBodegasAdmin(false);
        }
      }, [sbClient]);

      useEffect(() => { cargarBodegas(); }, [cargarBodegas]);

      const crearBodega = async (e) => {
        e.preventDefault();
        const correo = formNuevaBodega.correo.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
          notificar('Ingresa un correo válido (el de la cuenta de Google del dueño).', 'error');
          return;
        }
        setGuardandoNuevaBodega(true);
        try {
          // admin_crear_bodega_por_correo crea la bodega y la fila del dueño
          // (sin auth_id) en una sola transacción. El dueño entra con "Continuar
          // con Google" usando ESE correo: en su primer ingreso la cuenta se
          // vincula sola (ver reclamar_cuenta_por_correo). Ya no hay DNI ni PIN.
          const { data: bodegaNuevaId, error } = await sbClient.rpc('admin_crear_bodega_por_correo', {
            p_correo: correo,
            p_nombre_bodega: formNuevaBodega.nombreBodega.trim(),
            p_nombre_dueno: formNuevaBodega.nombreDueno.trim(),
            p_dias: Number(formNuevaBodega.dias) || 0,
            p_telefono: formNuevaBodega.telefono.trim() || null,
            p_mostrar_catalogo_maestro: formNuevaBodega.mostrarCatalogoMaestro,
            p_permitir_subir_fotos: formNuevaBodega.permitirSubirFotos
          });
          if (error) throw error;

          // El plan con catálogo activa "Pedidos WhatsApp" (KaseritaDelivery) y
          // anota el primer pago del combo, igual que al registrarse antes.
          const planElegido = planesAdmin.find((pl) => pl.id === (formNuevaBodega.planId || planPos?.id)) || null;
          let avisoPlan = '';
          if (planElegido?.permite_delivery && bodegaNuevaId) {
            let { error: errPlan } = await sbClient.from('bodegas').update({ delivery_permitido: true, combo_primer_pago_en: new Date().toISOString() }).eq('id', bodegaNuevaId);
            if (errPlan) ({ error: errPlan } = await sbClient.from('bodegas').update({ delivery_permitido: true }).eq('id', bodegaNuevaId));
            if (errPlan) avisoPlan = ' Ojo: no se pudo activar "Pedidos WhatsApp"; actívalo desde la fila de la bodega.';
          }

          // Primer pago: se anota en el historial junto con la bodega, en vez
          // de tener que abrir "Registrar pago" aparte apenas después de
          // crearla. Los días de vigencia ya se sumaron arriba (p_dias en la
          // creación), así que aquí va con p_dias: 0 -- solo deja constancia
          // del cobro, no vuelve a mover el vencimiento.
          let avisoPago = '';
          const montoPrimerPago = Number(formNuevaBodega.monto);
          if (planElegido && bodegaNuevaId && formNuevaBodega.monto !== '' && Number.isFinite(montoPrimerPago) && montoPrimerPago > 0) {
            const { error: errPago } = await sbClient.rpc('admin_registrar_pago_bodega', {
              p_bodega_id: bodegaNuevaId,
              p_monto: montoPrimerPago,
              p_dias: 0,
              p_plan_id: planElegido.id,
              p_medio: formNuevaBodega.medio || 'yape',
              p_nota: 'Primer pago (alta de la bodega)',
              p_fecha: null
            });
            if (errPago) {
              avisoPago = /could not find the function/i.test(errPago.message || '')
                ? ' Ojo: falta ejecutar pagos_bodega.sql para que quede el primer pago en el historial.'
                : ' Ojo: no se pudo anotar el primer pago en el historial; regístralo a mano.';
            } else {
              cargarPagos();
            }
          }

          const avisoTotal = `${avisoPlan}${avisoPago}`;
          notificar(`Bodega creada${planElegido ? ` (${planElegido.nombre})` : ''}. El dueño entra con "Continuar con Google" usando ${correo}.${avisoTotal}`, avisoTotal ? 'error' : 'success');
          setFormNuevaBodega({ correo: '', nombreBodega: '', nombreDueno: '', dias: '30', telefono: '', planId: '', monto: '', medio: 'yape', mostrarCatalogoMaestro: true, permitirSubirFotos: true });
          setModalNueva(false);
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo crear la bodega: ${err.message}`, 'error');
        } finally {
          setGuardandoNuevaBodega(false);
        }
      };

      // --- Consumo de almacenamiento en fotos, por bodega ---
      // Cada bodega guarda sus fotos en su propia carpeta dentro del bucket
      // "Productos" ("{bodega_id}/{producto_id}.jpg"), así que listar esa
      // carpeta y sumar el tamaño de cada archivo alcanza para saber cuánto
      // ocupa. Se calcula bajo demanda (botón) y no solo al cargar el panel
      // porque implica una llamada a Storage por cada bodega.
      const [consumoFotos, setConsumoFotos] = useState({});
      const [cargandoConsumoFotos, setCargandoConsumoFotos] = useState(false);
      const [busquedaBodegas, setBusquedaBodegas] = useState('');

      const cargarConsumoFotos = useCallback(async () => {
        setCargandoConsumoFotos(true);
        try {
          const resultados = await Promise.all(
            bodegasAdmin.map(async (b) => {
              const { data, error } = await sbClient.storage.from('Productos').list(b.id, { limit: 1000 });
              if (error || !data) return [b.id, { archivos: 0, bytes: 0 }];
              const bytes = data.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
              return [b.id, { archivos: data.length, bytes }];
            })
          );
          setConsumoFotos(Object.fromEntries(resultados));
        } catch (err) {
          notificar(`No se pudo calcular el consumo de fotos: ${err.message}`, 'error');
        } finally {
          setCargandoConsumoFotos(false);
        }
      }, [bodegasAdmin, sbClient, notificar]);

      const bodegasFiltradas = useMemo(() => {
        const termino = busquedaBodegas.trim().toLowerCase();
        if (!termino) return bodegasAdmin;
        return bodegasAdmin.filter((b) =>
          b.nombre.toLowerCase().includes(termino) ||
          b.dueno?.nombre?.toLowerCase().includes(termino) ||
          b.dueno?.dni?.includes(termino) ||
          b.dueno?.email?.toLowerCase().includes(termino)
        );
      }, [bodegasAdmin, busquedaBodegas]);

      const alternarCatalogoMaestroBodega = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ mostrar_catalogo_maestro: !bodega.mostrar_catalogo_maestro }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      // Función paga aparte del plan base -- si se le quita el permiso a una
      // bodega, también se le apaga el catálogo público (no tiene sentido
      // dejarlo "prendido" sin el permiso que lo cubre).
      const alternarDeliveryPermitidoBodega = async (bodega) => {
        try {
          const nuevoPermitido = !bodega.delivery_permitido;
          const payload = { delivery_permitido: nuevoPermitido };
          if (!nuevoPermitido) payload.delivery_habilitado = false;
          const { error } = await sbClient.from('bodegas').update(payload).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const alternarSubirFotosBodega = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ permitir_subir_fotos: !bodega.permitir_subir_fotos }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const alternarActiva = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ activa: !bodega.activa }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const extenderVigencia = async (bodega, dias) => {
        try {
          const base = bodega.activa_hasta && bodega.activa_hasta > fechaHoyISO() ? new Date(`${bodega.activa_hasta}T00:00:00`) : new Date();
          const nueva = fechaISOLocal(new Date(base.getTime() + dias * 86400000));
          const { error } = await sbClient.from('bodegas').update({ activa_hasta: nueva }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      const quitarVencimiento = async (bodega) => {
        try {
          const { error } = await sbClient.from('bodegas').update({ activa_hasta: null }).eq('id', bodega.id);
          if (error) throw error;
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        }
      };

      // ==========================================
      // BACKUP y ELIMINACIÓN DE BODEGA -- "por las dudas" antes de dar de
      // baja definitivamente a un negocio (o limpiar una de prueba).
      // ==========================================
      const [generandoBackupId, setGenerandoBackupId] = useState(null);
      const [modalEliminarBodega, setModalEliminarBodega] = useState(null);
      const [textoConfirmarEliminar, setTextoConfirmarEliminar] = useState('');
      // Por defecto SÍ se guarda el resumen (nombre, plan, cuánto pagó en
      // total) en bodegas_eliminadas, para comparar más adelante clientes
      // ganados vs. perdidos -- se destilda solo para una bodega de prueba
      // que no representa a un cliente real.
      const [conservarHistorialEliminar, setConservarHistorialEliminar] = useState(true);
      const [motivoEliminar, setMotivoEliminar] = useState('');
      const [eliminandoBodega, setEliminandoBodega] = useState(false);

      // Tablas que se relacionan con una bodega por una columna bodega_id
      // simple (sin sub-detalle que valga la pena anidar en el JSON).
      const TABLAS_BACKUP_SIMPLES = ['clientes', 'turnos_caja', 'mermas', 'pagos_credito', 'cajeros', 'categorias', 'tomas_inventario'];

      const descargarBackupBodega = async (bodega) => {
        setGenerandoBackupId(bodega.id);
        try {
          const resultados = await Promise.all([
            // Todas las columnas menos pin_acceso -- si la bodega
            // todavía no fue reclamada, ahí vive su PIN en texto plano
            // (necesario hasta su primer login, ver reclamar_cuenta_bodega)
            // y no tiene por qué terminar en un archivo descargable.
            sbClient.from('usuarios').select('id, bodega_id, nombre, dni, email, telefono, rol, activo, auth_id').eq('bodega_id', bodega.id),
            sbClient.from('productos').select('*').eq('bodega_id', bodega.id),
            sbClient.from('compras').select('*, compras_detalle(*)').eq('bodega_id', bodega.id),
            sbClient.from('ventas').select('*, ventas_detalle(*)').eq('bodega_id', bodega.id),
            sbClient.from('proveedores').select('*, pagos_proveedor(*)').eq('bodega_id', bodega.id),
            ...TABLAS_BACKUP_SIMPLES.map((t) => sbClient.from(t).select('*').eq('bodega_id', bodega.id))
          ]);
          const conError = resultados.find((r) => r.error);
          if (conError) throw conError.error;

          const [usuarios, productos, compras, ventas, proveedores, ...simples] = resultados.map((r) => r.data || []);
          const backup = { generado_en: new Date().toISOString(), bodega, usuarios, productos, compras, ventas, proveedores };
          TABLAS_BACKUP_SIMPLES.forEach((t, i) => { backup[t] = simples[i]; });

          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const nombreArchivo = `backup_${bodega.nombre.replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
          const a = document.createElement('a');
          a.href = url;
          a.download = nombreArchivo;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          notificar('Backup descargado.', 'success');
        } catch (err) {
          notificar(`No se pudo generar el backup: ${err.message}`, 'error');
        } finally {
          setGenerandoBackupId(null);
        }
      };

      const eliminarBodegaConfirmado = async () => {
        if (!modalEliminarBodega) return;
        setEliminandoBodega(true);
        try {
          // Las fotos que la bodega hubiera subido (antes de bloquear esa
          // función) se borran acá, con la API de Storage -- Supabase no
          // permite borrar directo por SQL en storage.objects ("Direct
          // deletion from storage tables is not allowed"), así que la
          // función del servidor ya no lo intenta.
          const { data: archivos } = await sbClient.storage.from('Productos').list(modalEliminarBodega.id);
          if (archivos && archivos.length > 0) {
            await sbClient.storage.from('Productos').remove(archivos.map((f) => `${modalEliminarBodega.id}/${f.name}`));
          }

          const { error } = await sbClient.rpc('admin_eliminar_bodega', {
            p_bodega_id: modalEliminarBodega.id,
            p_conservar_historial: conservarHistorialEliminar,
            p_motivo: motivoEliminar.trim() || null
          });
          if (error) {
            if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
              throw new Error('Falta ejecutar bodegas_eliminadas.sql en Supabase.');
            }
            throw error;
          }
          notificar(`Bodega eliminada junto con todos sus datos.${conservarHistorialEliminar ? ' Su resumen quedó guardado.' : ''}`, 'success');
          setModalEliminarBodega(null);
          setTextoConfirmarEliminar('');
          setConservarHistorialEliminar(true);
          setMotivoEliminar('');
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo eliminar: ${err.message}`, 'error');
        } finally {
          setEliminandoBodega(false);
        }
      };

      // ==========================================
      // EDITAR TELÉFONO y RESETEAR PIN -- para cuando el dueño cambia de
      // número o se olvida su PIN. El teléfono se edita directo (no toca
      // autenticación); el PIN se resetea borrando la cuenta de Auth (si
      // existe) y guardando el PIN nuevo en texto plano en pin_acceso --
      // igual que al crear la bodega, el dueño vuelve a "reclamarla" en su
      // próximo login (ver reclamar_cuenta_bodega), sin necesitar el
      // service_role key para cambiar la contraseña directamente.
      // ==========================================
      const [modalEditarBodega, setModalEditarBodega] = useState(null);
      const [telefonoEditar, setTelefonoEditar] = useState('');
      const [guardandoEditarBodega, setGuardandoEditarBodega] = useState(false);
      const [modalResetearPin, setModalResetearPin] = useState(null);
      const [nuevoPinReset, setNuevoPinReset] = useState('');
      const [reseteandoPin, setReseteandoPin] = useState(false);

      const guardarTelefonoBodega = async (e) => {
        e.preventDefault();
        if (!modalEditarBodega || !modalEditarBodega.dueno) return;
        setGuardandoEditarBodega(true);
        try {
          const { error } = await sbClient.from('usuarios')
            .update({ telefono: telefonoEditar.trim() || null })
            .eq('id', modalEditarBodega.dueno.id);
          if (error) throw error;
          notificar('Teléfono actualizado.', 'success');
          setModalEditarBodega(null);
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo actualizar: ${err.message}`, 'error');
        } finally {
          setGuardandoEditarBodega(false);
        }
      };

      const resetearPinConfirmado = async () => {
        if (!modalResetearPin) return;
        const pin = nuevoPinReset.trim();
        if (!pinValido(pin) || pin.length < PIN_MIN_DUENO) { notificar(`El PIN del dueño debe tener entre ${PIN_MIN_DUENO} y ${PIN_MAX} caracteres.`, 'error'); return; }
        setReseteandoPin(true);
        try {
          const { error } = await sbClient.rpc('admin_resetear_pin_bodega', { p_bodega_id: modalResetearPin.id, p_pin: pin });
          if (error) throw error;
          notificar('PIN reseteado. El dueño debe iniciar sesión con su DNI y el PIN nuevo para reclamar la cuenta de nuevo.', 'success');
          setModalResetearPin(null);
          setNuevoPinReset('');
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo resetear el PIN: ${err.message}`, 'error');
        } finally {
          setReseteandoPin(false);
        }
      };

      // ==========================================
      // CATÁLOGO MAESTRO -- banco de productos (descripción + categoría +
      // foto) que administra solo el super-admin. Cada bodega lo puede
      // leer para "importar" un producto al suyo (ver PosApp), pero solo
      // acá se crea, edita o borra.
      // ==========================================
      const [vistaAdmin, setVistaAdmin] = useState('bodegas');
      const [catalogoMaestro, setCatalogoMaestro] = useState([]);
      const [cargandoMaestro, setCargandoMaestro] = useState(false);
      const [busquedaMaestro, setBusquedaMaestro] = useState('');
      const [filtroFotoMaestro, setFiltroFotoMaestro] = useState('todos');
      const [formMaestro, setFormMaestro] = useState(null);
      const [guardandoMaestro, setGuardandoMaestro] = useState(false);
      const [subiendoFotoMaestro, setSubiendoFotoMaestro] = useState(false);
      const [previewImportMaestro, setPreviewImportMaestro] = useState(null);
      const [guardandoImportMaestro, setGuardandoImportMaestro] = useState(false);

      // --- Productos de Clientes: mercadería que una bodega agregó por su
      // cuenta y todavía no tiene ficha en el catálogo maestro -- se revisan
      // acá para, si conviene, sumarlas al maestro general (ver
      // guardarProductoMaestro, que detecta _origenProductoId). ---
      const [productosSinMaestro, setProductosSinMaestro] = useState([]);
      const [cargandoProductosSinMaestro, setCargandoProductosSinMaestro] = useState(false);
      const [busquedaProductosSinMaestro, setBusquedaProductosSinMaestro] = useState('');

      const cargarProductosSinMaestro = useCallback(async () => {
        setCargandoProductosSinMaestro(true);
        try {
          let { data, error } = await sbClient
            .from('productos')
            .select('id, descripcion, categoria, foto_url, cod_ean, bodega_id, bodegas(nombre)')
            .is('catalogo_maestro_id', null)
            .order('descripcion');
          if (error) {
            // El embed a "bodegas" puede fallar si PostgREST no reconoce esa
            // relación -- se reintenta sin el nombre de la bodega en vez de
            // dejar la sección entera rota.
            ({ data, error } = await sbClient
              .from('productos')
              .select('id, descripcion, categoria, foto_url, cod_ean, bodega_id')
              .is('catalogo_maestro_id', null)
              .order('descripcion'));
            if (error) throw error;
          }
          setProductosSinMaestro(data || []);
        } catch (err) {
          notificar(`No se pudo cargar la mercadería de clientes: ${err.message}`, 'error');
        } finally {
          setCargandoProductosSinMaestro(false);
        }
      }, [sbClient]);

      useEffect(() => {
        if (vistaAdmin === 'nuevos' && productosSinMaestro.length === 0) cargarProductosSinMaestro();
      }, [vistaAdmin, cargarProductosSinMaestro]);

      const productosSinMaestroFiltrado = productosSinMaestro.filter((p) =>
        !busquedaProductosSinMaestro.trim() || p.descripcion.toLowerCase().includes(busquedaProductosSinMaestro.trim().toLowerCase())
      );

      const abrirPromoverAMaestro = (p) => {
        setFormMaestro({
          id: crypto.randomUUID(),
          descripcion: p.descripcion,
          categoria: p.categoria || 'Abarrotes',
          sku: '',
          foto_url: p.foto_url || '',
          _origenProductoId: p.id
        });
        setVistaAdmin('maestro');
      };

      const cargarCatalogoMaestro = useCallback(async () => {
        setCargandoMaestro(true);
        try {
          const { data, error } = await sbClient.from('catalogo_maestro').select('*').order('descripcion');
          if (error) throw error;
          setCatalogoMaestro(data || []);
        } catch (err) {
          notificar(`No se pudo cargar el catálogo maestro: ${err.message}`, 'error');
        } finally {
          setCargandoMaestro(false);
        }
      }, [sbClient]);

      useEffect(() => {
        if (vistaAdmin === 'maestro' && catalogoMaestro.length === 0) cargarCatalogoMaestro();
      }, [vistaAdmin, cargarCatalogoMaestro]);

      const abrirNuevoProductoMaestro = () => {
        setFormMaestro({ id: crypto.randomUUID(), descripcion: '', categoria: 'Abarrotes', sku: '', foto_url: '' });
      };

      const subirFotoMaestro = async (file) => {
        setSubiendoFotoMaestro(true);
        try {
          const comprimida = await comprimirImagenJPEG(file, 20, 480);
          const ruta = `maestro/${formMaestro.id}.jpg`;
          const { error } = await sbClient.storage
            .from('Productos')
            .upload(ruta, comprimida, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
          if (error) throw error;
          const { data } = sbClient.storage.from('Productos').getPublicUrl(ruta);
          setFormMaestro((prev) => ({ ...prev, foto_url: `${data.publicUrl}?t=${Date.now()}` }));
        } catch (err) {
          notificar(`No se pudo subir la foto: ${err.message}`, 'error');
        } finally {
          setSubiendoFotoMaestro(false);
        }
      };

      // Con el formulario de un producto del catálogo maestro abierto, Ctrl+V
      // sube directo la imagen que se tenga copiada (ej. una foto del
      // producto bajada de internet) sin tener que guardarla como archivo
      // antes.
      useEffect(() => {
        if (!formMaestro) return;
        const manejarPegado = (e) => {
          const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith('image/'));
          if (item) subirFotoMaestro(item.getAsFile());
        };
        window.addEventListener('paste', manejarPegado);
        return () => window.removeEventListener('paste', manejarPegado);
      }, [formMaestro?.id]);

      const guardarProductoMaestro = async (e) => {
        e.preventDefault();
        setGuardandoMaestro(true);
        try {
          const payload = {
            id: formMaestro.id,
            descripcion: formMaestro.descripcion.trim(),
            categoria: formMaestro.categoria,
            // El SKU es un código interno de Kaserita, no un EAN real (ese
            // varía por proveedor/empaque) -- se genera solo, una sola vez.
            sku: (formMaestro.sku || '').trim() || generarSKU(formMaestro.categoria),
            foto_url: formMaestro.foto_url || null
          };
          const { error } = await sbClient.from('catalogo_maestro').upsert([payload]);
          if (error) throw error;

          // Si este formulario se abrió desde "Productos de Clientes" (un
          // producto que una bodega agregó por su cuenta, todavía sin ficha
          // en el maestro), se vincula ese producto a la ficha recién creada
          // -- así deja de aparecer en esa lista de pendientes y, de paso, si
          // más adelante se le mejora la foto en el maestro, esa bodega la ve
          // actualizada sola.
          if (formMaestro._origenProductoId) {
            const { error: errVincular } = await sbClient.rpc('admin_vincular_producto_maestro', {
              p_producto_id: formMaestro._origenProductoId,
              p_catalogo_maestro_id: payload.id
            });
            if (errVincular) throw errVincular;
            setProductosSinMaestro((prev) => prev.filter((p) => p.id !== formMaestro._origenProductoId));
            notificar('Producto agregado al catálogo maestro y vinculado a la bodega que lo creó.', 'success');
            setFormMaestro(null);
            setVistaAdmin('nuevos');
          } else {
            notificar('Producto guardado en el catálogo maestro.', 'success');
            setFormMaestro(null);
          }
          cargarCatalogoMaestro();
        } catch (err) {
          notificar(`No se pudo guardar: ${err.message}`, 'error');
        } finally {
          setGuardandoMaestro(false);
        }
      };

      const eliminarProductoMaestro = async (item) => {
        if (!window.confirm(`¿Borrar "${item.descripcion}" del catálogo maestro? Esto no afecta los productos que ya importó alguna bodega.`)) return;
        try {
          const { error } = await sbClient.from('catalogo_maestro').delete().eq('id', item.id);
          if (error) throw error;
          cargarCatalogoMaestro();
        } catch (err) {
          notificar(`No se pudo borrar: ${err.message}`, 'error');
        }
      };

      const catalogoMaestroConFoto = catalogoMaestro.filter((p) => !!p.foto_url).length;
      const catalogoMaestroSinFoto = catalogoMaestro.length - catalogoMaestroConFoto;

      const catalogoMaestroFiltrado = catalogoMaestro.filter((p) => {
        if (filtroFotoMaestro === 'con' && !p.foto_url) return false;
        if (filtroFotoMaestro === 'sin' && p.foto_url) return false;
        return !busquedaMaestro.trim() || p.descripcion.toLowerCase().includes(busquedaMaestro.trim().toLowerCase());
      });

      // Importación masiva desde un Excel/CSV de un proveedor (ej. la lista de
      // precios de un distribuidor con columnas de código, descripción,
      // marca y categoría) -- así no hay que tipear producto por producto en
      // el formulario de arriba. Los encabezados de columna pueden variar
      // según el proveedor, por eso se buscan por varios nombres posibles en
      // vez de exigir uno exacto.
      const procesarArchivoImportMaestro = (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            await asegurarXLSX();
            const libro = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const hoja = libro.Sheets[libro.SheetNames[0]];
            const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

            const buscarCampo = (fila, candidatos) => {
              const claves = Object.keys(fila);
              for (const candidato of candidatos) {
                const clave = claves.find((k) => normalizarCategoria(k) === candidato);
                if (clave && fila[clave] !== '') return fila[clave].toString().trim();
              }
              return '';
            };

            const existentesPorSku = new Map(
              catalogoMaestro.filter((p) => p.sku).map((p) => [p.sku.trim().toLowerCase(), p])
            );

            const items = filas.map((fila) => {
              const descripcion = buscarCampo(fila, ['descripcion', 'producto', 'nombre', 'detalle', 'item']);
              if (!descripcion) return null;
              const categoriaTexto = buscarCampo(fila, ['categoria', 'rubro', 'familia']);
              const codigo = buscarCampo(fila, ['lovis', 'sku', 'codigo', 'cod']);
              const categoria = categoriaDesdeTexto(categoriaTexto);
              // Solo marca "reconocida" si matcheó una de las categorías con
              // ícono propio de Kaserita -- si se conservó tal cual vino del
              // proveedor (rubro propio, ej. "RTD"), se avisa igual aunque sí
              // se haya guardado su texto real (no se perdió en "Otros").
              const normCategoria = normalizarCategoria(categoriaTexto);
              const categoriaConIcono = !!(CATEGORIA_ESTILO_POR_NOMBRE_NORMALIZADO[normCategoria] || CATEGORIA_ALIAS[normCategoria]);
              const existente = codigo ? existentesPorSku.get(codigo.toLowerCase()) : null;
              return {
                id: existente ? existente.id : crypto.randomUUID(),
                descripcion,
                categoria,
                sku: codigo || generarSKU(categoria),
                foto_url: existente ? (existente.foto_url || null) : null,
                _categoriaReconocida: !categoriaTexto || categoriaConIcono,
                _actualiza: !!existente
              };
            }).filter(Boolean);

            if (items.length === 0) {
              notificar('No se encontró ninguna fila con descripción en el archivo.', 'error');
              return;
            }
            setPreviewImportMaestro(items);
          } catch (err) {
            notificar(`No se pudo leer el archivo: ${err.message}`, 'error');
          }
        };
        reader.readAsArrayBuffer(file);
      };

      const confirmarImportMaestro = async () => {
        if (!previewImportMaestro || previewImportMaestro.length === 0) return;
        setGuardandoImportMaestro(true);
        try {
          const payload = previewImportMaestro.map(({ _categoriaReconocida, _actualiza, ...resto }) => resto);
          const TAMANO_LOTE = 300;
          for (let i = 0; i < payload.length; i += TAMANO_LOTE) {
            const { error } = await sbClient.from('catalogo_maestro').upsert(payload.slice(i, i + TAMANO_LOTE));
            if (error) throw error;
          }
          notificar(`Se importaron ${payload.length} productos al catálogo maestro.`, 'success');
          setPreviewImportMaestro(null);
          cargarCatalogoMaestro();
        } catch (err) {
          notificar(`No se pudo importar: ${err.message}`, 'error');
        } finally {
          setGuardandoImportMaestro(false);
        }
      };

      // ==========================================
      // VISTA "BODEGAS": agrupada por urgencia (vencidas, por vencer, sin
      // ingresar, al día, desactivadas) para ver qué cobrar primero.
      // ==========================================
      const [modalNueva, setModalNueva] = useState(false);
      const [menuFila, setMenuFila] = useState(null);
      const [gruposAbiertos, setGruposAbiertos] = useState({ venc: true, porv: true, nuevo: true, ok: false, off: false });
      const [planesAdmin, setPlanesAdmin] = useState([]);
      const [modalCambioPlan, setModalCambioPlan] = useState(null);
      const [planNuevoId, setPlanNuevoId] = useState('');
      const [guardandoCambioPlan, setGuardandoCambioPlan] = useState(false);

      // ---- Historial de pagos (ver pagos_bodega.sql) ----
      const [pagosAdmin, setPagosAdmin] = useState([]);
      const [pagosDisponibles, setPagosDisponibles] = useState(false);
      const [modalPago, setModalPago] = useState(null);
      const [guardandoPago, setGuardandoPago] = useState(false);
      const [modalHistorial, setModalHistorial] = useState(null);
      const [historial, setHistorial] = useState([]);
      const [cargandoHistorial, setCargandoHistorial] = useState(false);
      const [pagoPorAnular, setPagoPorAnular] = useState(null);

      const cargarPagos = useCallback(async () => {
        const { data, error } = await sbClient
          .from('pagos_bodega')
          .select('id, bodega_id, fecha_pago, monto, plan_nombre')
          .eq('anulado', false)
          .order('fecha_pago', { ascending: false })
          .order('creado_en', { ascending: false })
          .limit(1000);
        if (error) {
          // Sin la tabla (aún no se corrió pagos_bodega.sql) el panel sigue igual.
          console.warn('[admin] pagos_bodega:', error.message);
          setPagosDisponibles(false);
          setPagosAdmin([]);
          return;
        }
        setPagosDisponibles(true);
        setPagosAdmin(data || []);
      }, [sbClient]);
      useEffect(() => { cargarPagos(); }, [cargarPagos]);

      // ---- Bodegas eliminadas (ver bodegas_eliminadas.sql) -- para
      // comparar clientes ganados vs. perdidos en el tiempo. Se carga
      // recién al abrir el modal, no en cada render del panel.
      const [bajasAdmin, setBajasAdmin] = useState([]);
      const [bajasDisponibles, setBajasDisponibles] = useState(true);
      const [cargandoBajas, setCargandoBajas] = useState(false);
      const [modalBajas, setModalBajas] = useState(false);

      const abrirModalBajas = async () => {
        setModalBajas(true);
        setCargandoBajas(true);
        const { data, error } = await sbClient
          .from('bodegas_eliminadas')
          .select('*')
          .order('eliminado_en', { ascending: false })
          .limit(500);
        if (error) {
          console.warn('[admin] bodegas_eliminadas:', error.message);
          setBajasDisponibles(false);
          setBajasAdmin([]);
        } else {
          setBajasDisponibles(true);
          setBajasAdmin(data || []);
        }
        setCargandoBajas(false);
      };

      // El plan de cada bodega se deduce de si tiene "Pedidos WhatsApp"
      // (delivery_permitido): con eso, plan con catálogo; sin eso, solo POS.
      useEffect(() => {
        sbClient.from('planes_kaserita').select('*').eq('activo', true).then(({ data }) => setPlanesAdmin(data || []));
      }, [sbClient]);

      // ---- Visitas a la landing y a /registro (ver analitica_eventos.sql) ----
      const [analitica, setAnalitica] = useState(null); // null = aún no se sabe si el SQL está corrido
      useEffect(() => {
        sbClient.rpc('admin_resumen_analitica', { p_dias: 30 }).then(({ data, error }) => {
          if (error) { console.warn('[admin] admin_resumen_analitica:', error.message); setAnalitica(false); return; }
          setAnalitica(data || []);
        });
      }, [sbClient]);
      const sumaAnalitica = (pagina, evento, dias) => {
        if (!Array.isArray(analitica)) return 0;
        const desde = fechaISOLocal(new Date(Date.now() - dias * 86400000));
        return analitica
          .filter((f) => f.pagina === pagina && f.evento === evento && f.fecha >= desde)
          .reduce((acc, f) => acc + Number(f.total), 0);
      };
      const planPos = planesAdmin.find((pl) => !pl.permite_delivery) || null;
      const planCat = planesAdmin.find((pl) => pl.permite_delivery) || null;
      const planDe = (b) => (b.delivery_permitido ? planCat : planPos);

      const ultimoPagoPorBodega = new Map();
      pagosAdmin.forEach((pg) => { if (!ultimoPagoPorBodega.has(pg.bodega_id)) ultimoPagoPorBodega.set(pg.bodega_id, pg); });
      const cobradoEsteMes = pagosAdmin
        .filter((pg) => pg.fecha_pago && pg.fecha_pago.slice(0, 7) === fechaHoyISO().slice(0, 7))
        .reduce((acc, pg) => acc + Number(pg.monto || 0), 0);
      const fechaCorta = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '');
      const fechaLarga = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE') : 'Sin vencimiento');

      // Monto sugerido: el precio de promo mientras la bodega esté dentro de
      // sus primeros pagos de ese plan; después, el precio regular.
      const sugerirMonto = (b, plan) => {
        if (!plan) return '';
        const previos = pagosAdmin.filter((pg) => pg.bodega_id === b.id && pg.plan_nombre === plan.nombre).length;
        const usaPromo = plan.precio_soles_promo != null && previos < Number(plan.meses_promo || 0);
        return Number(usaPromo ? plan.precio_soles_promo : plan.precio_soles).toFixed(2);
      };

      const abrirModalPago = (b) => {
        const plan = planDe(b) || planPos || planesAdmin[0] || null;
        setModalPago({ b, planId: plan?.id || '', monto: sugerirMonto(b, plan), fecha: fechaHoyISO(), dias: '30', medio: 'yape', nota: '' });
      };

      const registrarPago = async (e) => {
        e.preventDefault();
        const f = modalPago;
        if (!f) return;
        const monto = Number(f.monto);
        const dias = Math.trunc(Number(f.dias));
        if (f.monto === '' || !Number.isFinite(monto) || monto < 0) { notificar('Escribe un monto válido.', 'error'); return; }
        if (!Number.isFinite(dias) || dias < 0 || dias > 400) { notificar('Los días deben estar entre 0 y 400.', 'error'); return; }
        setGuardandoPago(true);
        try {
          const { data, error } = await sbClient.rpc('admin_registrar_pago_bodega', {
            p_bodega_id: f.b.id,
            p_monto: monto,
            p_dias: dias,
            p_plan_id: f.planId || null,
            p_medio: f.medio,
            p_nota: f.nota.trim() || null,
            p_fecha: f.fecha || null
          });
          if (error) {
            if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
              throw new Error('Falta ejecutar pagos_bodega.sql en Supabase.');
            }
            throw error;
          }
          notificar(`Pago de S/ ${monto.toFixed(2)} registrado. ${f.b.nombre}: ${data?.vence_despues ? `vence el ${fechaLarga(data.vence_despues)}` : 'sin vencimiento'}.`, 'success');
          setModalPago(null);
          cargarBodegas();
          cargarPagos();
        } catch (err) {
          notificar(`No se pudo registrar el pago: ${err.message}`, 'error');
        } finally {
          setGuardandoPago(false);
        }
      };

      const abrirHistorial = async (b) => {
        setModalHistorial(b);
        setHistorial([]);
        setPagoPorAnular(null);
        setCargandoHistorial(true);
        try {
          const { data, error } = await sbClient
            .from('pagos_bodega')
            .select('*')
            .eq('bodega_id', b.id)
            .order('fecha_pago', { ascending: false })
            .order('creado_en', { ascending: false });
          if (error) throw error;
          setHistorial(data || []);
        } catch (err) {
          notificar(`No se pudo cargar el historial: ${err.message}`, 'error');
        } finally {
          setCargandoHistorial(false);
        }
      };

      const anularPago = async (pg) => {
        try {
          const { error } = await sbClient.rpc('admin_anular_pago_bodega', { p_pago_id: pg.id, p_motivo: null });
          if (error) throw error;
          notificar('Pago anulado. Se quitaron los días que había sumado.', 'success');
          setPagoPorAnular(null);
          if (modalHistorial) abrirHistorial(modalHistorial);
          cargarBodegas();
          cargarPagos();
        } catch (err) {
          notificar(`No se pudo anular el pago: ${err.message}`, 'error');
        }
      };

      const abrirCambioPlan = (b) => {
        setModalCambioPlan(b);
        setPlanNuevoId((planDe(b) || planPos || planesAdmin[0])?.id || '');
      };

      // Cambio de plan: el plan con catálogo es "Pedidos WhatsApp"
      // (delivery_permitido) prendido. Subir de plan lo prende y anota el
      // primer pago del combo; bajar de plan lo apaga y también apaga el
      // catálogo público. Opcionalmente registra el pago del nuevo plan.
      const cambiarPlanBodega = async (e) => {
        e.preventDefault();
        const b = modalCambioPlan;
        const nuevo = planesAdmin.find((pl) => pl.id === planNuevoId);
        if (!b || !nuevo) return;
        const cambia = !!nuevo.permite_delivery !== !!b.delivery_permitido;
        if (!cambia) { setModalCambioPlan(null); return; }
        setGuardandoCambioPlan(true);
        try {
          const payload = {};
          if (cambia) {
            payload.delivery_permitido = !!nuevo.permite_delivery;
            if (!nuevo.permite_delivery) payload.delivery_habilitado = false;
            else if (!b.combo_primer_pago_en) payload.combo_primer_pago_en = new Date().toISOString();
          }
          let { error } = await sbClient.from('bodegas').update(payload).eq('id', b.id);
          if (error && payload.combo_primer_pago_en) {
            delete payload.combo_primer_pago_en;
            ({ error } = await sbClient.from('bodegas').update(payload).eq('id', b.id));
          }
          if (error) throw error;
          notificar(`${b.nombre} ahora tiene el plan ${nuevo.nombre}.`, 'success');
          setModalCambioPlan(null);
          cargarBodegas();
        } catch (err) {
          notificar(`No se pudo cambiar el plan: ${err.message}`, 'error');
        } finally {
          setGuardandoCambioPlan(false);
        }
      };

      const estadoDe = (b) => {
        if (b.dueno && !b.dueno.auth_id) return { k: 'nuevo', t: 'Aún no ingresa', pill: 'bg-sky-100 text-sky-700', dias: null };
        if (b.activa === false) return { k: 'off', t: 'Desactivada', pill: 'bg-stone-200 text-stone-600', dias: null };
        if (!b.activa_hasta) return { k: 'ok', t: 'Sin vencimiento', pill: 'bg-emerald-100 text-emerald-700', dias: null };
        const dias = Math.round((new Date(`${b.activa_hasta}T00:00:00`) - new Date(`${fechaHoyISO()}T00:00:00`)) / 86400000);
        if (dias < 0) return { k: 'venc', t: `Vencida hace ${-dias} d`, pill: 'bg-rose-100 text-rose-700', dias };
        if (dias === 0) return { k: 'porv', t: 'Vence hoy', pill: 'bg-amber-100 text-amber-700', dias };
        if (dias <= 7) return { k: 'porv', t: `Vence en ${dias} d`, pill: 'bg-amber-100 text-amber-700', dias };
        return { k: 'ok', t: `Al día · ${dias} d`, pill: 'bg-emerald-100 text-emerald-700', dias };
      };
      const iniciales = (nombre) => (nombre || '?').split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase();
      const precioPlan = (b) => Number(planDe(b)?.precio_soles) || 0;

      const GRUPOS_ADMIN = [
        { k: 'venc', titulo: 'Vencidas', pill: 'bg-rose-100 text-rose-700' },
        { k: 'porv', titulo: 'Vencen en 7 días', pill: 'bg-amber-100 text-amber-700' },
        { k: 'nuevo', titulo: 'Aún no ingresan', pill: 'bg-sky-100 text-sky-700' },
        { k: 'ok', titulo: 'Al día', pill: 'bg-emerald-100 text-emerald-700' },
        { k: 'off', titulo: 'Desactivadas', pill: 'bg-stone-200 text-stone-600' }
      ];
      const enBusqueda = busquedaBodegas.trim() !== '';
      const datosGrupos = GRUPOS_ADMIN.map((g) => {
        const items = bodegasFiltradas
          .map((b) => ({ b, e: estadoDe(b) }))
          .filter((x) => x.e.k === g.k)
          .sort((x, y) => (x.e.dias ?? 9999) - (y.e.dias ?? 9999));
        const monto = g.k === 'venc' || g.k === 'porv' ? items.reduce((acc, x) => acc + precioPlan(x.b), 0) : 0;
        return { ...g, items, monto };
      });
      const kpiCuenta = (k) => bodegasAdmin.filter((b) => estadoDe(b).k === k).length;
      const porCobrarTotal = bodegasAdmin
        .filter((b) => ['venc', 'porv'].includes(estadoDe(b).k))
        .reduce((acc, b) => acc + precioPlan(b), 0);
      const irAGrupo = (k) => {
        setGruposAbiertos((prev) => ({ ...prev, [k]: true }));
        setTimeout(() => document.getElementById(`grupo-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      };

      // Recordatorio por WhatsApp: si la bodega vence o ya venció, el mensaje
      // ya sale escrito con el plan y el precio; si no, abre el chat vacío.
      const escribirAlDueno = (b, e) => {
        const soloNumeros = (b.dueno?.telefono || '').replace(/\D/g, '');
        if (!soloNumeros) return;
        const telConCodigo = soloNumeros.length === 9 ? `51${soloNumeros}` : soloNumeros;
        let url = `https://wa.me/${telConCodigo}`;
        if (e.k === 'venc' || e.k === 'porv') {
          const cuando = e.dias < 0 ? `venció hace ${-e.dias} días` : e.dias === 0 ? 'vence hoy' : `vence en ${e.dias} días`;
          const plan = planDe(b);
          const nombre = (b.dueno?.nombre || '').split(' ')[0];
          const texto = `Hola ${nombre}, te escribimos de Kaserita. La suscripción de ${b.nombre} ${cuando}.` +
            (plan ? `\nSi quieres seguir con tu plan ${plan.nombre} (S/ ${Number(plan.precio_soles).toFixed(2)} al mes), puedes yapear y avisarnos por aquí. ¡Gracias!` : '\nSi quieres seguir, puedes yapear y avisarnos por aquí. ¡Gracias!');
          url += `?text=${encodeURIComponent(texto)}`;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      };

      return (
        <div className="h-screen bg-stone-50 flex flex-col overflow-hidden">
          {toast.visible && (
            <div className={`fixed top-6 inset-x-4 md:inset-x-auto md:right-6 md:max-w-xs z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border-l-4 bg-white text-xs font-semibold ${toast.tipo === 'error' ? 'border-rose-500 text-rose-700' : 'border-emerald-500 text-emerald-700'}`}>
              <i className={`fa-solid ${toast.tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-sm shrink-0`}></i>
              {toast.texto}
            </div>
          )}

          <header className="shrink-0 bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 px-2.5 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
                <img src="/logo-blanco-wordmark.png" alt="Kaserita" className="h-3.5 w-auto" />
              </div>
              <div>
                <h1 className="text-sm font-black leading-tight">Panel de Administrador</h1>
                <p className="text-[11px] text-stone-400">{adminSesion.nombre || 'Administrador'}</p>
              </div>
            </div>
            <button onClick={onCerrarSesion} className="text-xs font-semibold text-stone-300 hover:text-white flex items-center gap-1.5">
              <i className="fa-solid fa-right-from-bracket"></i> Salir
            </button>
          </header>

          <div className="shrink-0 bg-white border-b border-stone-200 px-4 md:px-6 flex gap-1 pt-2">
            <button
              onClick={() => setVistaAdmin('bodegas')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition ${vistaAdmin === 'bodegas' ? 'bg-stone-100 text-stone-900 border-t border-x border-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
            >
              <i className="fa-solid fa-store mr-1.5"></i> Bodegas
            </button>
            <button
              onClick={() => setVistaAdmin('maestro')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition ${vistaAdmin === 'maestro' ? 'bg-stone-100 text-stone-900 border-t border-x border-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
            >
              <i className="fa-solid fa-book mr-1.5"></i> Catálogo Maestro
            </button>
            <button
              onClick={() => setVistaAdmin('nuevos')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition ${vistaAdmin === 'nuevos' ? 'bg-stone-100 text-stone-900 border-t border-x border-stone-200' : 'text-stone-500 hover:text-stone-800'}`}
            >
              <i className="fa-solid fa-boxes-packing mr-1.5"></i> Productos de Clientes
              {productosSinMaestro.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px]">{productosSinMaestro.length}</span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-stone-100">
          {vistaAdmin === 'bodegas' && (
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
              {[
                ['ok', 'Al día', 'text-stone-900'],
                ['porv', 'Vencen en 7 días', 'text-amber-600'],
                ['venc', 'Vencidas', 'text-rose-600'],
                ['nuevo', 'Aún no ingresan', 'text-sky-600']
              ].map(([k, etiqueta, color]) => (
                <button key={k} type="button" onClick={() => irAGrupo(k)} className="text-left bg-white border border-stone-200 hover:border-violet-300 rounded-xl px-3.5 py-3 transition">
                  <span className="block text-[11px] font-semibold text-stone-500">{etiqueta}</span>
                  <span className={`block text-2xl font-black tabular-nums ${color}`}>{kpiCuenta(k)}</span>
                </button>
              ))}
              <div className="bg-white border border-stone-200 rounded-xl px-3.5 py-3" title="Suma de los pagos registrados con fecha de este mes (sin los anulados).">
                <span className="block text-[11px] font-semibold text-stone-500">Cobrado este mes</span>
                <span className="block text-2xl font-black tabular-nums text-emerald-600">{pagosDisponibles ? `S/ ${cobradoEsteMes.toFixed(2)}` : '—'}</span>
              </div>
              <div className="col-span-2 md:col-span-1 bg-white border border-stone-200 rounded-xl px-3.5 py-3" title="Suma del precio regular del plan de cada bodega vencida o por vencer. Es un estimado: no considera promociones.">
                <span className="block text-[11px] font-semibold text-stone-500">Por cobrar (aprox.)</span>
                <span className="block text-2xl font-black tabular-nums text-stone-900">{planPos || planCat ? `S/ ${porCobrarTotal.toFixed(2)}` : '—'}</span>
              </div>
            </div>

            {analitica !== false && (
              <div className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5 shrink-0">
                  <i className="fa-solid fa-chart-line text-violet-600"></i> Visitas (últimos 7 / 30 días)
                </h3>
                {[
                  ['Vio la landing', 'inicio', 'vista'],
                  ['Tocó "Crear mi cuenta"', 'inicio', 'click_crear_cuenta'],
                  ['Vio /registro', 'registro', 'vista'],
                  ['Tocó "Continuar por WhatsApp"', 'registro', 'click_whatsapp']
                ].map(([etiqueta, pagina, evento]) => (
                  <span key={etiqueta} className="text-xs text-stone-600">
                    {etiqueta}: <b className="text-stone-900 tabular-nums">{sumaAnalitica(pagina, evento, 7)}</b>
                    <span className="text-stone-400"> / {sumaAnalitica(pagina, evento, 30)}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                <input
                  type="text"
                  value={busquedaBodegas}
                  onChange={(e) => setBusquedaBodegas(e.target.value)}
                  placeholder="Buscar por bodega, dueño o correo..."
                  aria-label="Buscar bodega"
                  className="w-full pl-8 pr-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <button
                onClick={cargarConsumoFotos}
                disabled={cargandoConsumoFotos || bodegasAdmin.length === 0}
                className="text-xs font-semibold px-3 py-2.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-60 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-images text-[10px]"></i>
                {cargandoConsumoFotos ? 'Calculando...' : 'Ver consumo de fotos'}
              </button>
              <button
                onClick={abrirModalBajas}
                className="text-xs font-semibold px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-1.5"
              >
                <i className="fa-solid fa-user-slash text-[10px]"></i> Clientes que se fueron
              </button>
              <button
                onClick={() => setModalNueva(true)}
                className="text-sm font-bold px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white flex items-center gap-2"
              >
                <i className="fa-solid fa-plus text-xs"></i> Nueva bodega
              </button>
            </div>

            {cargandoBodegasAdmin ? (
              <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
            ) : bodegasAdmin.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-6">Todavía no creaste ninguna bodega.</p>
            ) : bodegasFiltradas.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-6">Ninguna bodega coincide con "{busquedaBodegas}".</p>
            ) : (
              datosGrupos.filter((g) => g.items.length > 0).map((g) => {
                const abierto = enBusqueda || gruposAbiertos[g.k];
                return (
                  <section key={g.k} id={`grupo-${g.k}`} className="bg-white border border-stone-200 rounded-2xl scroll-mt-3">
                    <div className={`flex items-center gap-2.5 px-4 py-2.5 bg-stone-50 flex-wrap rounded-t-2xl ${abierto ? 'border-b border-stone-200' : 'rounded-b-2xl'}`}>
                      <button
                        type="button"
                        onClick={() => setGruposAbiertos((prev) => ({ ...prev, [g.k]: !prev[g.k] }))}
                        aria-expanded={abierto}
                        className="flex items-center gap-2"
                      >
                        <i className={`fa-solid fa-chevron-down text-[10px] text-stone-400 transition-transform ${abierto ? '' : '-rotate-90'}`}></i>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${g.pill}`}>{g.titulo}</span>
                        <span className="text-xs text-stone-500">{g.items.length} {g.items.length === 1 ? 'bodega' : 'bodegas'}</span>
                      </button>
                      <span className="flex-1"></span>
                      {g.monto > 0 && <span className="text-xs font-extrabold tabular-nums text-stone-700">S/ {g.monto.toFixed(2)} por cobrar</span>}
                    </div>

                    {abierto && (
                      <div>
                        <div className="hidden md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_150px_auto] gap-x-4 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          <span>Bodega</span><span>Vigencia</span><span>Plan</span><span className="text-center">Módulos</span><span className="w-[132px]"></span>
                        </div>
                        {g.items.map(({ b, e }) => {
                          const pct = e.dias === null ? 100 : Math.max(0, Math.min(100, (e.dias / 30) * 100));
                          const colorBarra = e.k === 'venc' ? 'bg-rose-500' : e.k === 'porv' ? 'bg-amber-500' : e.k === 'ok' ? 'bg-emerald-500' : 'bg-stone-300';
                          const urgente = e.k === 'venc' || e.k === 'porv';
                          return (
                            <div key={b.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_150px_auto] gap-x-4 gap-y-2.5 items-center px-4 py-3 border-t border-stone-100">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-black shrink-0">{iniciales(b.nombre)}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-stone-900 truncate">{b.nombre}</p>
                                  <p className="text-xs text-stone-500 truncate">
                                    {b.dueno ? `${b.dueno.nombre} · ${b.dueno.email || `DNI ${b.dueno.dni}`}` : 'Sin dueño registrado'}
                                    {consumoFotos[b.id] && ` · ${consumoFotos[b.id].archivos} fotos (${formatearBytes(consumoFotos[b.id].bytes)})`}
                                  </p>
                                </div>
                              </div>

                              <div title={b.activa_hasta ? `Vigencia hasta el ${new Date(`${b.activa_hasta}T00:00:00`).toLocaleDateString('es-PE')}` : 'Sin vencimiento'}>
                                <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${e.pill}`}>{e.t}</span>
                                <div className="h-1.5 w-28 rounded-full bg-stone-100 overflow-hidden mt-1.5">
                                  <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${pct}%` }}></div>
                                </div>
                                {pagosDisponibles && (
                                  <p className="text-[10px] text-stone-400 mt-1">
                                    {ultimoPagoPorBodega.get(b.id)
                                      ? `Último pago: ${fechaCorta(ultimoPagoPorBodega.get(b.id).fecha_pago)} · S/ ${Number(ultimoPagoPorBodega.get(b.id).monto).toFixed(2)}`
                                      : 'Sin pagos registrados'}
                                  </p>
                                )}
                              </div>

                              <div>
                                {planesAdmin.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => abrirCambioPlan(b)}
                                    title="Cambiar de plan"
                                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 flex items-center gap-1.5"
                                  >
                                    {b.delivery_permitido ? 'POS + Catálogo' : 'Punto de Venta'}
                                    <i className="fa-solid fa-arrows-up-down text-[9px]"></i>
                                  </button>
                                ) : (
                                  <span className="text-xs text-stone-400">—</span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 md:justify-center">
                                <MiniInterruptor activo={b.mostrar_catalogo_maestro} onClick={() => alternarCatalogoMaestroBodega(b)} etiqueta="Maestro" title="Mostrar/ocultar el Catálogo Maestro en esta bodega" />
                                <MiniInterruptor activo={b.permitir_subir_fotos} onClick={() => alternarSubirFotosBodega(b)} etiqueta="Fotos" title="Permitir/bloquear que esta bodega suba fotos de sus productos" />
                                <MiniInterruptor activo={b.delivery_permitido} onClick={() => alternarDeliveryPermitidoBodega(b)} etiqueta="Pedidos" title="Habilitar/deshabilitar Pedidos por WhatsApp (KaseritaDelivery) para esta bodega -- función paga aparte del plan base" />
                              </div>

                              <div className="flex items-center gap-1.5 justify-end relative">
                                <button
                                  onClick={() => abrirModalPago(b)}
                                  title="Registrar el pago (Yape, efectivo o transferencia) y sumar días de vigencia"
                                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${urgente ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                                >
                                  <i className="fa-solid fa-mobile-screen text-[10px]"></i> Pago
                                </button>
                                {b.dueno && b.dueno.telefono && (
                                  <button
                                    onClick={() => escribirAlDueno(b, e)}
                                    title={urgente ? `Recordar el pago a ${b.dueno.nombre} por WhatsApp` : `Escribir a ${b.dueno.nombre} por WhatsApp`}
                                    aria-label="WhatsApp"
                                    className="w-8 h-8 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg"
                                  >
                                    <i className="fa-brands fa-whatsapp text-sm"></i>
                                  </button>
                                )}
                                <button
                                  onClick={() => setMenuFila(menuFila === b.id ? null : b.id)}
                                  aria-haspopup="menu"
                                  aria-label="Más acciones"
                                  className="w-8 h-8 flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg"
                                >
                                  <i className="fa-solid fa-ellipsis text-sm"></i>
                                </button>
                                {menuFila === b.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setMenuFila(null)}></div>
                                    <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-stone-200 rounded-xl shadow-xl p-1.5 text-xs font-semibold text-stone-700">
                                      {[
                                        ['Historial de pagos', 'fa-clock-rotate-left text-sky-600', () => abrirHistorial(b)],
                                        ['Cambiar plan', 'fa-arrows-up-down text-violet-600', () => abrirCambioPlan(b)],
                                        [b.activa ? 'Desactivar ahora' : 'Activar', b.activa ? 'fa-power-off text-rose-500' : 'fa-power-off text-emerald-600', () => alternarActiva(b)],
                                        ['+7 días de vigencia', 'fa-calendar-plus', () => extenderVigencia(b, 7)],
                                        ['+30 días de vigencia', 'fa-calendar-plus', () => extenderVigencia(b, 30)],
                                        ...(b.activa_hasta ? [['Quitar vencimiento', 'fa-infinity', () => quitarVencimiento(b)]] : []),
                                        null,
                                        [generandoBackupId === b.id ? 'Generando backup...' : 'Backup', 'fa-download text-sky-600', () => descargarBackupBodega(b)],
                                        ...(b.dueno ? [['Editar teléfono', 'fa-pen', () => { setModalEditarBodega(b); setTelefonoEditar(b.dueno.telefono || ''); }]] : []),
                                        ...(b.dueno && b.dueno.dni ? [['Resetear PIN', 'fa-key text-violet-600', () => { setModalResetearPin(b); setNuevoPinReset(''); }]] : []),
                                        null,
                                        ['Eliminar tienda', 'fa-trash text-rose-600', () => { setModalEliminarBodega(b); setTextoConfirmarEliminar(''); setConservarHistorialEliminar(true); setMotivoEliminar(''); }]
                                      ].map((it, i) => it === null ? (
                                        <div key={`sep-${i}`} className="my-1 border-t border-stone-100"></div>
                                      ) : (
                                        <button
                                          key={it[0]}
                                          role="menuitem"
                                          onClick={() => { setMenuFila(null); it[2](); }}
                                          className={`w-full text-left px-2.5 py-2 rounded-lg hover:bg-stone-50 flex items-center gap-2.5 ${it[0] === 'Eliminar tienda' ? 'text-rose-600' : ''}`}
                                        >
                                          <i className={`fa-solid ${it[1]} w-4 text-center text-[11px] ${it[1].includes('text-') ? '' : 'text-stone-400'}`}></i> {it[0]}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}

            {modalPago && (() => {
              const f = modalPago;
              const hoy = fechaHoyISO();
              const diasNum = Math.trunc(Number(f.dias)) || 0;
              const baseVence = f.b.activa_hasta && f.b.activa_hasta > hoy ? f.b.activa_hasta : hoy;
              const nuevaVence = diasNum > 0 ? fechaISOLocal(new Date(new Date(`${baseVence}T00:00:00`).getTime() + diasNum * 86400000)) : f.b.activa_hasta;
              const actualiza = (cambios) => setModalPago({ ...f, ...cambios });
              const campo = 'w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900';
              return (
                <div className="fixed inset-0 z-40 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => !guardandoPago && setModalPago(null)}>
                  <form onSubmit={registrarPago} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setModalPago(null)} aria-label="Cerrar" className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 pr-8">
                      <i className="fa-solid fa-mobile-screen text-violet-600"></i> Registrar pago
                    </h3>
                    <p className="text-xs text-stone-500">{f.b.nombre} · vigencia actual: <b className="text-stone-700">{fechaLarga(f.b.activa_hasta)}</b></p>
                    {planesAdmin.length > 0 && (
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Plan que paga:</label>
                        <select
                          value={f.planId}
                          onChange={(e) => {
                            const plan = planesAdmin.find((pl) => pl.id === e.target.value);
                            actualiza({ planId: e.target.value, monto: sugerirMonto(f.b, plan) });
                          }}
                          className={campo}
                        >
                          {[...planesAdmin].sort((a, b) => Number(a.precio_soles) - Number(b.precio_soles)).map((pl) => (
                            <option key={pl.id} value={pl.id}>{pl.nombre}{pl.permite_delivery ? ' (con Pedidos WhatsApp)' : ''}</option>
                          ))}
                        </select>
                        {(() => {
                          const plan = planesAdmin.find((pl) => pl.id === f.planId);
                          if (!plan || !!plan.permite_delivery === !!f.b.delivery_permitido) return null;
                          return (
                            <p className="text-[11px] text-violet-700 mt-1">
                              {plan.permite_delivery ? 'Cambio de plan: se activa "Pedidos WhatsApp".' : 'Cambio de plan: se apaga "Pedidos WhatsApp" y su catálogo público.'}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Monto cobrado (S/):</label>
                        <input type="number" min="0" step="0.01" inputMode="decimal" value={f.monto} onChange={(e) => actualiza({ monto: e.target.value })} className={campo} />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Días a sumar:</label>
                        <input type="number" min="0" max="400" step="1" value={f.dias} onChange={(e) => actualiza({ dias: e.target.value })} className={campo} />
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Medio de pago:</label>
                        <select value={f.medio} onChange={(e) => actualiza({ medio: e.target.value })} className={campo}>
                          <option value="yape">Yape</option>
                          <option value="plin">Plin</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-stone-600 block mb-1">Fecha del pago:</label>
                        <input type="date" value={f.fecha} max={hoy} onChange={(e) => actualiza({ fecha: e.target.value })} className={campo} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Nota (opcional):</label>
                      <input type="text" maxLength={200} placeholder="Ej: Yape a nombre de Juan, operación 123456" value={f.nota} onChange={(e) => actualiza({ nota: e.target.value })} className={campo} />
                    </div>
                    <p className="text-[11px] rounded-lg px-3 py-2 bg-violet-50 text-violet-800">
                      {diasNum > 0
                        ? <>La bodega pasará a vencer el <b>{fechaLarga(nuevaVence)}</b> y quedará activa.</>
                        : 'Con 0 días solo se anota el pago; la vigencia no cambia.'}
                    </p>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setModalPago(null)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">Cancelar</button>
                      <button type="submit" disabled={guardandoPago} className="px-4 py-2 text-xs font-bold rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60">
                        {guardandoPago ? 'Guardando...' : 'Registrar pago'}
                      </button>
                    </div>
                  </form>
                </div>
              );
            })()}

            {modalHistorial && (() => {
              const vigentes = historial.filter((pg) => !pg.anulado);
              const total = vigentes.reduce((acc, pg) => acc + Number(pg.monto || 0), 0);
              return (
                <div className="fixed inset-0 z-40 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => setModalHistorial(null)}>
                  <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setModalHistorial(null)} aria-label="Cerrar" className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 pr-8">
                      <i className="fa-solid fa-clock-rotate-left text-sky-600"></i> Historial de pagos
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {modalHistorial.nombre} · {vigentes.length} {vigentes.length === 1 ? 'pago' : 'pagos'} · total cobrado <b className="text-stone-700">S/ {total.toFixed(2)}</b>
                    </p>
                    <div className="mt-3">
                      {cargandoHistorial ? (
                        <p className="text-xs text-stone-500 text-center py-8">Cargando...</p>
                      ) : historial.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-8">Esta bodega todavía no tiene pagos registrados.</p>
                      ) : (
                        <div className="space-y-2">
                          {historial.map((pg) => (
                            <div key={pg.id} className={`border rounded-xl px-3.5 py-2.5 ${pg.anulado ? 'border-stone-200 bg-stone-50 opacity-70' : 'border-stone-200'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-stone-900">
                                    <span className={pg.anulado ? 'line-through' : ''}>S/ {Number(pg.monto).toFixed(2)}</span>
                                    <span className="ml-2 text-xs font-semibold text-stone-500 capitalize">{pg.medio}</span>
                                    {pg.anulado && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">ANULADO</span>}
                                  </p>
                                  <p className="text-xs text-stone-500">
                                    {fechaLarga(pg.fecha_pago)}{pg.plan_nombre ? ` · ${pg.plan_nombre}` : ''}
                                    {pg.dias > 0 ? ` · +${pg.dias} días` : ' · solo registro'}
                                  </p>
                                  {pg.dias > 0 && (
                                    <p className="text-[11px] text-stone-400">Vencía {fechaLarga(pg.vence_antes)} → pasó a {fechaLarga(pg.vence_despues)}</p>
                                  )}
                                  {pg.nota && <p className="text-[11px] text-stone-500 mt-0.5">“{pg.nota}”</p>}
                                </div>
                                {!pg.anulado && (
                                  pagoPorAnular === pg.id ? (
                                    <span className="shrink-0 flex items-center gap-1.5 text-[11px]">
                                      <span className="text-stone-500">¿Anular?</span>
                                      <button onClick={() => anularPago(pg)} className="font-bold px-2 py-1 rounded-md bg-rose-600 text-white">Sí</button>
                                      <button onClick={() => setPagoPorAnular(null)} className="font-semibold px-2 py-1 rounded-md bg-stone-100 text-stone-700">No</button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setPagoPorAnular(pg.id)} className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100">Anular</button>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-4">
                      <p className="text-[11px] text-stone-400">Anular un pago quita los días que sumó. El registro queda en el historial.</p>
                      <button onClick={() => { const b = modalHistorial; setModalHistorial(null); abrirModalPago(b); }} className="shrink-0 px-3 py-2 text-xs font-bold rounded-lg bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1.5">
                        <i className="fa-solid fa-plus text-[10px]"></i> Registrar pago
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {modalBajas && (() => {
              const total = bajasAdmin.reduce((acc, r) => acc + Number(r.total_pagado || 0), 0);
              return (
                <div className="fixed inset-0 z-40 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => setModalBajas(false)}>
                  <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setModalBajas(false)} aria-label="Cerrar" className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 pr-8">
                      <i className="fa-solid fa-user-slash text-rose-600"></i> Clientes que se fueron
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {bajasAdmin.length} {bajasAdmin.length === 1 ? 'bodega eliminada' : 'bodegas eliminadas'} con historial guardado · pagaron en total <b className="text-stone-700">S/ {total.toFixed(2)}</b>
                    </p>
                    <div className="mt-3">
                      {cargandoBajas ? (
                        <p className="text-xs text-stone-500 text-center py-8">Cargando...</p>
                      ) : !bajasDisponibles ? (
                        <p className="text-xs text-stone-500 text-center py-8">Falta ejecutar bodegas_eliminadas.sql en Supabase.</p>
                      ) : bajasAdmin.length === 0 ? (
                        <p className="text-xs text-stone-500 text-center py-8">Todavía no eliminaste ninguna bodega guardando su historial.</p>
                      ) : (
                        <div className="space-y-2">
                          {bajasAdmin.map((r) => (
                            <div key={r.id} className="border border-stone-200 rounded-xl px-3.5 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-stone-900">{r.nombre_bodega}</p>
                                  <p className="text-xs text-stone-500">
                                    {r.nombre_dueno || 'Sin nombre'}{r.correo_dueno ? ` · ${r.correo_dueno}` : ''}
                                  </p>
                                  <p className="text-xs text-stone-500 mt-0.5">
                                    {r.plan_nombre || 'Sin plan'} · {r.cantidad_pagos} {r.cantidad_pagos === 1 ? 'pago' : 'pagos'} · total <b className="text-stone-700">S/ {Number(r.total_pagado || 0).toFixed(2)}</b>
                                  </p>
                                  {r.primer_pago_en && (
                                    <p className="text-[11px] text-stone-400">Pagó desde {fechaLarga(r.primer_pago_en)} hasta {fechaLarga(r.ultimo_pago_en)}</p>
                                  )}
                                  {r.motivo && <p className="text-[11px] text-stone-500 mt-0.5">“{r.motivo}”</p>}
                                </div>
                                <p className="shrink-0 text-[11px] text-stone-400 text-right">Eliminada<br />{fechaLarga(r.eliminado_en?.slice(0, 10))}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {modalCambioPlan && (
              <div className="fixed inset-0 z-40 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => !guardandoCambioPlan && setModalCambioPlan(null)}>
                <form onSubmit={cambiarPlanBodega} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setModalCambioPlan(null)}
                    aria-label="Cerrar"
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 pr-8">
                    <i className="fa-solid fa-arrows-up-down text-violet-600"></i> Cambiar plan
                  </h3>
                  <p className="text-xs text-stone-500">
                    {modalCambioPlan.nombre} · plan actual: <b className="text-stone-700">{modalCambioPlan.delivery_permitido ? 'POS + Catálogo' : 'Punto de Venta'}</b>
                  </p>
                  <div className="space-y-2">
                    {[...planesAdmin].sort((a, b) => Number(a.precio_soles) - Number(b.precio_soles)).map((pl) => (
                      <label key={pl.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${planNuevoId === pl.id ? 'border-violet-500 bg-violet-50' : 'border-stone-200 hover:border-stone-300'}`}>
                        <input type="radio" name="plan-nuevo" checked={planNuevoId === pl.id} onChange={() => setPlanNuevoId(pl.id)} className="mt-1 accent-violet-600" />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-bold text-stone-900">{pl.nombre}</span>
                            <span className="text-sm font-extrabold tabular-nums">S/ {Number(pl.precio_soles_promo ?? pl.precio_soles).toFixed(2)}<small className="text-[11px] font-medium text-stone-500"> /mes</small></span>
                          </span>
                          <span className="block text-[11px] text-stone-500 mt-0.5">
                            {pl.precio_soles_promo != null ? `Promo en los primeros ${pl.meses_promo} pagos; después S/ ${Number(pl.precio_soles).toFixed(2)}. ` : ''}
                            {pl.permite_delivery ? 'Incluye Pedidos por WhatsApp (KaseritaDelivery).' : 'Solo Punto de Venta.'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {(() => {
                    const nuevo = planesAdmin.find((pl) => pl.id === planNuevoId);
                    if (!nuevo) return null;
                    const sube = !!nuevo.permite_delivery && !modalCambioPlan.delivery_permitido;
                    const baja = !nuevo.permite_delivery && !!modalCambioPlan.delivery_permitido;
                    if (!sube && !baja) return <p className="text-[11px] text-stone-500 bg-stone-50 rounded-lg px-3 py-2">Es el mismo plan que ya tiene.</p>;
                    return (
                      <p className={`text-[11px] rounded-lg px-3 py-2 ${baja ? 'bg-amber-50 text-amber-800' : 'bg-violet-50 text-violet-800'}`}>
                        {sube
                          ? 'Se activa "Pedidos WhatsApp": la bodega podrá publicar su catálogo en KaseritaDelivery.'
                          : 'Se apaga "Pedidos WhatsApp" y su catálogo público deja de mostrarse. Sus productos y ventas no se pierden.'}
                      </p>
                    );
                  })()}
                  <p className="text-[11px] text-stone-500">Esto solo cambia el plan. Para cobrarlo y sumar días de vigencia usa <b>Pago</b> y elige el plan nuevo.</p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setModalCambioPlan(null)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">Cancelar</button>
                    <button type="submit" disabled={guardandoCambioPlan} className="px-4 py-2 text-xs font-bold rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60">
                      {guardandoCambioPlan ? 'Guardando...' : 'Guardar cambio'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {modalNueva && (
              <div className="fixed inset-0 z-40 bg-stone-900/50 flex items-center justify-center p-4" onClick={() => !guardandoNuevaBodega && setModalNueva(false)}>
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setModalNueva(false)}
                    aria-label="Cerrar"
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
            <form onSubmit={crearBodega} className="space-y-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <i className="fa-solid fa-store text-orange-600"></i> Nueva Bodega
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-stone-600 block mb-1">Correo del Dueño (con el que entrará con Google):</label>
                  <input
                    type="email" required placeholder="Ej: juan@gmail.com"
                    value={formNuevaBodega.correo}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, correo: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Nombre de la Bodega:</label>
                  <input
                    type="text" required placeholder="Ej: Bodega Don Pepe"
                    value={formNuevaBodega.nombreBodega}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, nombreBodega: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Nombre del Dueño:</label>
                  <input
                    type="text" required placeholder="Ej: Juan Pérez"
                    value={formNuevaBodega.nombreDueno}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, nombreDueno: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Celular del Dueño (WhatsApp, opcional):</label>
                  <input
                    type="text" placeholder="Ej: 987654321"
                    value={formNuevaBodega.telefono}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, telefono: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Días de vigencia (0 = sin vencimiento):</label>
                  <input
                    type="number" min="0" step="1"
                    value={formNuevaBodega.dias}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, dias: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
              </div>
              {planesAdmin.length > 0 && (
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Plan:</label>
                  <select
                    value={formNuevaBodega.planId || planPos?.id || planesAdmin[0].id}
                    onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, planId: e.target.value, monto: '' })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  >
                    {[...planesAdmin].sort((a, b) => Number(a.precio_soles) - Number(b.precio_soles)).map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.nombre} · S/ {Number(pl.precio_soles_promo ?? pl.precio_soles).toFixed(2)} al mes
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const pl = planesAdmin.find((x) => x.id === (formNuevaBodega.planId || planPos?.id || planesAdmin[0].id));
                    if (!pl) return null;
                    return (
                      <p className="text-[11px] text-stone-500 mt-1">
                        {pl.precio_soles_promo != null ? `Promo en los primeros ${pl.meses_promo} pagos; después S/ ${Number(pl.precio_soles).toFixed(2)}. ` : ''}
                        {pl.permite_delivery ? 'Incluye Pedidos por WhatsApp (KaseritaDelivery).' : 'Solo Punto de Venta.'}
                      </p>
                    );
                  })()}
                </div>
              )}
              {planesAdmin.length > 0 && (() => {
                const pl = planesAdmin.find((x) => x.id === (formNuevaBodega.planId || planPos?.id || planesAdmin[0].id));
                const sugerido = pl ? Number(pl.precio_soles_promo ?? pl.precio_soles).toFixed(2) : '';
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Monto cobrado (S/, 0 si aún no paga):</label>
                      <input
                        type="number" min="0" step="0.01" inputMode="decimal"
                        placeholder={sugerido}
                        value={formNuevaBodega.monto !== '' ? formNuevaBodega.monto : sugerido}
                        onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, monto: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-stone-600 block mb-1">Medio de pago:</label>
                      <select
                        value={formNuevaBodega.medio}
                        onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, medio: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                      >
                        <option value="yape">Yape</option>
                        <option value="plin">Plin</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <p className="col-span-2 text-[11px] text-stone-500 -mt-1">Este primer pago queda anotado en el "Historial de pagos" de la bodega.</p>
                  </div>
                );
              })()}
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formNuevaBodega.mostrarCatalogoMaestro}
                  onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, mostrarCatalogoMaestro: e.target.checked })}
                  className="rounded border-stone-300"
                />
                Mostrar el Catálogo Maestro en esta bodega (sugerencias e importar productos)
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formNuevaBodega.permitirSubirFotos}
                  onChange={(e) => setFormNuevaBodega({ ...formNuevaBodega, permitirSubirFotos: e.target.checked })}
                  className="rounded border-stone-300"
                />
                Permitir que esta bodega suba fotos de sus productos
              </label>
              <button
                type="submit"
                disabled={guardandoNuevaBodega}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow"
              >
                {guardandoNuevaBodega ? 'Creando...' : 'Crear Bodega'}
              </button>
            </form>
                </div>
              </div>
            )}
          </div>
          )}

          {vistaAdmin === 'maestro' && (
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {formMaestro ? (
              <form onSubmit={guardarProductoMaestro} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-book text-orange-600"></i> {formMaestro._origenProductoId ? 'Agregar al Catálogo Maestro' : catalogoMaestro.some((p) => p.id === formMaestro.id) ? 'Editar Producto' : 'Nuevo Producto del Catálogo Maestro'}
                </h2>
                {formMaestro._origenProductoId && (
                  <p className="text-xs text-stone-500 -mt-2">
                    Revisa/corrige la descripción, categoría y foto antes de sumarlo al catálogo general -- esto no modifica el producto tal cual quedó en la bodega que lo creó.
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <label className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer group border border-stone-200">
                    <FotoProducto
                      fotoUrl={formMaestro.foto_url}
                      categoria={formMaestro.categoria}
                      className="w-16 h-16"
                      iconClassName="text-xl"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                      {subiendoFotoMaestro ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i className="fa-solid fa-camera text-white text-sm opacity-0 group-hover:opacity-100 transition"></i>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        e.target.value = '';
                        if (file) subirFotoMaestro(file);
                      }}
                    />
                  </label>
                  <p className="text-xs text-stone-500">
                    <span className="font-semibold text-stone-700 block">Foto del producto</span>
                    Toca el cuadro para {formMaestro.foto_url ? 'cambiarla' : 'subir una'}, o copia una imagen y pégala con Ctrl+V.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Descripción:</label>
                  <input
                    type="text" required placeholder="Ej: Coca Cola 500ml"
                    value={formMaestro.descripcion}
                    onChange={(e) => setFormMaestro({ ...formMaestro, descripcion: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-600 block mb-1">Categoría:</label>
                  <select
                    value={formMaestro.categoria}
                    onChange={(e) => setFormMaestro({ ...formMaestro, categoria: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-900"
                  >
                    {!CATEGORIAS_FALLBACK.includes(formMaestro.categoria) && formMaestro.categoria && (
                      <option value={formMaestro.categoria}>{formMaestro.categoria} (del proveedor)</option>
                    )}
                    {CATEGORIAS_FALLBACK.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {formMaestro.sku && (
                  <p className="text-xs text-stone-500">SKU: <span className="font-mono">{formMaestro.sku}</span></p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const veniaDeNuevos = !!formMaestro._origenProductoId;
                      setFormMaestro(null);
                      if (veniaDeNuevos) setVistaAdmin('nuevos');
                    }}
                    className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoMaestro} className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow">
                    {guardandoMaestro ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            ) : previewImportMaestro ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-file-import text-orange-600"></i> Revisar importación ({previewImportMaestro.length} productos)
                </h2>
                <p className="text-xs text-stone-500">
                  Se detectaron {previewImportMaestro.length} filas con descripción. Las categorías en <span className="font-semibold text-amber-700">amarillo</span> se guardan tal cual venían en el archivo porque no coinciden con las categorías con ícono de Kaserita (puedes editarlas después desde la lista); las que vinieron vacías quedan como "Otros".
                </p>
                <div className="max-h-80 overflow-y-auto border border-stone-100 rounded-xl divide-y divide-stone-100">
                  {previewImportMaestro.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="flex-1 min-w-0 truncate font-semibold text-stone-800">{item.descripcion}</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full font-semibold ${item._categoriaReconocida ? 'bg-stone-100 text-stone-600' : 'bg-amber-50 text-amber-700'}`}>
                        {item.categoria}
                      </span>
                      <span className="shrink-0 font-mono text-stone-400">{item.sku}</span>
                      {item._actualiza && <span className="shrink-0 text-[10px] font-semibold text-sky-600">Actualiza</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setPreviewImportMaestro(null)} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl">
                    Cancelar
                  </button>
                  <button type="button" onClick={confirmarImportMaestro} disabled={guardandoImportMaestro} className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow">
                    {guardandoImportMaestro ? 'Importando...' : `Importar ${previewImportMaestro.length} productos`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
                  <input
                    type="text" placeholder="Buscar producto..."
                    value={busquedaMaestro}
                    onChange={(e) => setBusquedaMaestro(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900"
                  />
                </div>
                <label className="shrink-0 px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold text-sm rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer">
                  <i className="fa-solid fa-file-excel text-emerald-600"></i> Importar Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      e.target.value = '';
                      if (file) procesarArchivoImportMaestro(file);
                    }}
                  />
                </label>
                <button onClick={abrirNuevoProductoMaestro} className="shrink-0 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl shadow flex items-center gap-1.5">
                  <i className="fa-solid fa-plus"></i> Nuevo
                </button>
              </div>
            )}

            {!formMaestro && !previewImportMaestro && (
              <div className="flex items-center gap-1.5">
                {[
                  { valor: 'todos', etiqueta: `Todos (${catalogoMaestro.length})` },
                  { valor: 'sin', etiqueta: `Sin foto (${catalogoMaestroSinFoto})` },
                  { valor: 'con', etiqueta: `Con foto (${catalogoMaestroConFoto})` }
                ].map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => setFiltroFotoMaestro(op.valor)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroFotoMaestro === op.valor ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'}`}
                  >
                    {op.etiqueta}
                  </button>
                ))}
              </div>
            )}

            {!formMaestro && !previewImportMaestro && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <i className="fa-solid fa-list text-orange-600"></i> Catálogo Maestro ({catalogoMaestroFiltrado.length})
                </h2>
                {cargandoMaestro ? (
                  <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
                ) : catalogoMaestroFiltrado.length === 0 ? (
                  <p className="text-xs text-stone-500 text-center py-6">
                    {catalogoMaestro.length === 0 ? 'Todavía no agregaste ningún producto al catálogo maestro.' : 'No se encontraron productos con esa búsqueda.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catalogoMaestroFiltrado.map((p) => (
                      <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
                        <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-12 h-12 rounded-lg shrink-0" iconClassName="text-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-stone-900 truncate">{p.descripcion}</p>
                          <p className="text-[11px] text-stone-500">{p.categoria || 'Sin categoría'}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setFormMaestro({ id: p.id, descripcion: p.descripcion, categoria: p.categoria || 'Abarrotes', sku: p.sku || '', foto_url: p.foto_url || '' })} className="w-7 h-7 flex items-center justify-center bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg">
                            <i className="fa-solid fa-pen text-xs"></i>
                          </button>
                          <button onClick={() => eliminarProductoMaestro(p)} className="w-7 h-7 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg">
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {vistaAdmin === 'nuevos' && (
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
            <p className="text-xs text-stone-500">
              Mercadería que alguna bodega agregó por su cuenta y todavía no tiene ficha en el catálogo maestro. Revisa la descripción/foto y, si conviene, súmala al catálogo general para que le sirva de sugerencia a todas las demás bodegas también.
            </p>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"></i>
              <input
                type="text" placeholder="Buscar producto..."
                value={busquedaProductosSinMaestro}
                onChange={(e) => setBusquedaProductosSinMaestro(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-900"
              />
            </div>
            {cargandoProductosSinMaestro ? (
              <p className="text-xs text-stone-500 text-center py-6">Cargando...</p>
            ) : productosSinMaestroFiltrado.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-6">
                {productosSinMaestro.length === 0 ? 'No hay mercadería pendiente -- todo lo que agregaron las bodegas ya está en el catálogo maestro.' : 'No se encontraron productos con esa búsqueda.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {productosSinMaestroFiltrado.map((p) => (
                  <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
                    <FotoProducto fotoUrl={p.foto_url} categoria={p.categoria} className="w-12 h-12 rounded-lg shrink-0" iconClassName="text-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-stone-900 truncate">{p.descripcion}</p>
                      <p className="text-[11px] text-stone-500 truncate">{p.categoria || 'Sin categoría'}{p.bodegas?.nombre ? ` · ${p.bodegas.nombre}` : ''}</p>
                    </div>
                    <button
                      onClick={() => abrirPromoverAMaestro(p)}
                      title="Agregar al catálogo maestro"
                      className="shrink-0 w-7 h-7 flex items-center justify-center bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg"
                    >
                      <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
          </div>

          {modalEditarBodega && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <form onSubmit={guardarTelefonoBodega} className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
                <h3 className="text-sm font-bold text-stone-900">Editar teléfono -- {modalEditarBodega.nombre}</h3>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Teléfono de {modalEditarBodega.dueno?.nombre}</label>
                  <input
                    type="text"
                    autoFocus
                    value={telefonoEditar}
                    onChange={(e) => setTelefonoEditar(e.target.value)}
                    placeholder="999888777"
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModalEditarBodega(null)} className="flex-1 py-2.5 bg-white/70 hover:bg-white/70 text-stone-600 font-bold text-sm rounded-full shadow-sm">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoEditarBodega} className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-60 text-white font-bold text-sm rounded-full">
                    {guardandoEditarBodega ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {modalResetearPin && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-amber-600">
                  <i className="fa-solid fa-key text-lg"></i>
                  <h3 className="text-sm font-bold">Resetear PIN -- {modalResetearPin.nombre}</h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Se cerrará la sesión actual de {modalResetearPin.dueno?.nombre} y deberá volver a ingresar con su DNI y el PIN nuevo la próxima vez.
                </p>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">PIN nuevo (8 a 32 caracteres)</label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={PIN_MAX}
                    value={nuevoPinReset}
                    onChange={(e) => setNuevoPinReset(e.target.value)}
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalResetearPin(null); setNuevoPinReset(''); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-white/70 text-stone-600 font-bold text-sm rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={resetearPinConfirmado}
                    disabled={reseteandoPin || !pinValido(nuevoPinReset) || nuevoPinReset.trim().length < PIN_MIN_DUENO}
                    className="flex-1 py-2.5 bg-[#6105dc] hover:bg-[#4d04b0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full"
                  >
                    {reseteandoPin ? 'Reseteando...' : 'Resetear PIN'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {modalEliminarBodega && (
            <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-[#f4effc] via-[#f9f8fb] to-[#f5f4f8] border border-white/80 rounded-[28px] max-w-sm w-full p-5 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <i className="fa-solid fa-triangle-exclamation text-lg"></i>
                  <h3 className="text-sm font-bold">Eliminar "{modalEliminarBodega.nombre}"</h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Esto borra <strong>para siempre</strong> todas las ventas, compras, productos, clientes, turnos de caja y demás datos de esta bodega, junto con su cuenta de acceso. No se puede deshacer.
                </p>
                <button
                  onClick={() => descargarBackupBodega(modalEliminarBodega)}
                  disabled={generandoBackupId === modalEliminarBodega.id}
                  className="w-full py-2 bg-sky-50 hover:bg-sky-100 disabled:opacity-60 text-sky-700 font-bold text-xs rounded-full flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-download text-[10px]"></i> {generandoBackupId === modalEliminarBodega.id ? 'Generando...' : 'Descargar backup primero'}
                </button>
                <label className="flex items-start gap-2 text-xs text-stone-600 cursor-pointer bg-white/60 rounded-xl px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={conservarHistorialEliminar}
                    onChange={(e) => setConservarHistorialEliminar(e.target.checked)}
                    className="rounded border-stone-300 mt-0.5"
                  />
                  <span>
                    <span className="font-semibold text-stone-700">Guardar su resumen</span> (nombre, dueño, plan y cuánto pagó en total) para el comparativo de clientes ganados y perdidos. Desmárcalo si es una bodega de prueba.
                  </span>
                </label>
                {conservarHistorialEliminar && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Motivo (opcional)</label>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Ej: cerró el negocio, se fue con la competencia..."
                      value={motivoEliminar}
                      onChange={(e) => setMotivoEliminar(e.target.value)}
                      className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">Escribe "{modalEliminarBodega.nombre}" para confirmar</label>
                  <input
                    type="text"
                    autoFocus
                    value={textoConfirmarEliminar}
                    onChange={(e) => setTextoConfirmarEliminar(e.target.value)}
                    className="w-full bg-white border border-stone-200/70 shadow-sm rounded-xl px-3 py-2 text-sm text-stone-900 mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setModalEliminarBodega(null); setTextoConfirmarEliminar(''); }}
                    className="flex-1 py-2.5 bg-white/70 hover:bg-white/70 text-stone-600 font-bold text-sm rounded-full shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={eliminarBodegaConfirmado}
                    disabled={eliminandoBodega || textoConfirmarEliminar.trim() !== modalEliminarBodega.nombre}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full"
                  >
                    {eliminandoBodega ? 'Eliminando...' : 'Eliminar definitivamente'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
