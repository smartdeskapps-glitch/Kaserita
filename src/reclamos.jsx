import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hzmrsbeamtbloudmxjrp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw";
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const vacio = {
  nombre_completo: '',
  documento_identidad: '',
  domicilio: '',
  telefono: '',
  email: '',
  es_menor_edad: false,
  bien_contratado: '',
  monto_reclamado: '',
  tipo: 'reclamo',
  detalle: '',
  pedido: '',
  web: '', // trampa para bots: una persona nunca lo ve ni lo llena
};

// Código de seguimiento: 8 caracteres al azar criptográfico (sin letras ni
// números que se confunden, como 0/O o 1/I) para que no se repita.
function generarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
  return `RC-${new Date().getFullYear()}-${rand}`;
}

const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;
const fechaHoy = () => new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
// DNI: 8 dígitos. Carné de extranjería / pasaporte: 9 a 20 letras o números.
const documentoValido = (d) => /^[0-9]{8}$/.test(d) || /^[A-Za-z0-9]{9,20}$/.test(d);

export default function App() {
  const [form, setForm] = useState(vacio);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState(null);
  const [constancia, setConstancia] = useState(null);

  const set = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre_completo.trim() || !form.documento_identidad.trim() || !form.email.trim() || !form.detalle.trim() || !form.pedido.trim()) {
      setError('Completa los campos obligatorios (*) antes de enviar.');
      return;
    }
    if (!documentoValido(form.documento_identidad.trim())) {
      setError('Revisa tu documento: el DNI tiene 8 dígitos; el carné de extranjería o pasaporte, entre 9 y 20 letras o números, sin espacios.');
      return;
    }
    // Bot: se simula que todo salió bien, sin guardar nada.
    if (form.web) { setCodigo('RC-' + new Date().getFullYear() + '-ENVIADO'); return; }
    try {
      const ultimo = Number(localStorage.getItem('reclamo_ultimo_envio') || 0);
      if (Date.now() - ultimo < ESPERA_ENTRE_ENVIOS_MS) {
        setError('Ya enviaste un reclamo hace un momento. Espera un minuto antes de enviar otro.');
        return;
      }
    } catch { /* sin localStorage: se sigue igual */ }
    setEnviando(true);
    try {
      let codigoGenerado = '';
      let errIns = null;
      // Si el código al azar ya existiera (casi imposible), se genera otro.
      for (let intento = 0; intento < 3; intento++) {
        codigoGenerado = generarCodigo();
        ({ error: errIns } = await sbClient.from('libro_reclamaciones').insert([{
        codigo: codigoGenerado,
        nombre_completo: form.nombre_completo.trim(),
        documento_identidad: form.documento_identidad.trim(),
        domicilio: form.domicilio.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim(),
        es_menor_edad: form.es_menor_edad,
        bien_contratado: form.bien_contratado.trim() || null,
        monto_reclamado: form.monto_reclamado ? Number(form.monto_reclamado) : null,
        tipo: form.tipo,
        detalle: form.detalle.trim(),
        pedido: form.pedido.trim(),
        }]));
        if (!errIns || errIns.code !== '23505') break;
      }
      if (errIns) throw errIns;
      try { localStorage.setItem('reclamo_ultimo_envio', String(Date.now())); } catch { /* ignorar */ }
      setConstancia({ fecha: fechaHoy(), nombre: form.nombre_completo.trim(), documento: form.documento_identidad.trim(), email: form.email.trim(), tipo: form.tipo, detalle: form.detalle.trim(), pedido: form.pedido.trim() });
      setCodigo(codigoGenerado);
    } catch (err) {
      setError('No se pudo registrar tu reclamo. Intenta de nuevo o escríbenos a smartdeskapps@smartdeskapps.com.');
    } finally {
      setEnviando(false);
    }
  };

  if (codigo) {
    return (
      <div className="wrap">
        <Topbar />
        <div className="card center-block">
          <div className="success-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2>Reclamo registrado</h2>
          <p className="screen-sub">Tu código de seguimiento es:</p>
          <p className="codigo">{codigo}</p>
          {constancia && (
            <div className="constancia">
              <p><b>Fecha:</b> {constancia.fecha}</p>
              <p><b>Reclamante:</b> {constancia.nombre} ({constancia.documento})</p>
              <p><b>Correo:</b> {constancia.email}</p>
              <p><b>Tipo:</b> {constancia.tipo === 'queja' ? 'Queja' : 'Reclamo'}</p>
              <p><b>Detalle:</b> {constancia.detalle}</p>
              <p><b>Pedido del consumidor:</b> {constancia.pedido}</p>
              <p><b>Proveedor:</b> SmartdeskApps, RUC 10490217644</p>
            </div>
          )}
          <button type="button" className="pay-btn no-print" onClick={() => window.print()}>Imprimir o guardar constancia (PDF)</button>
          <p className="screen-sub">Guarda este código. Te responderemos al correo indicado en un plazo máximo de 30 días calendario, conforme al Código de Protección y Defensa del Consumidor (Ley N.º 29571) y su Reglamento del Libro de Reclamaciones (D.S. N.º 070-2017-PCM).</p>
          <a className="back no-print" href="/">← Volver a Kaserita</a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <Topbar />
      <div className="card">
        <h1>Libro de Reclamaciones</h1>
        <p className="screen-sub">Conforme a lo establecido en el Código de Protección y Defensa del Consumidor (Ley N.º 29571) y su Reglamento del Libro de Reclamaciones (D.S. N.º 070-2017-PCM), este establecimiento cuenta con un Libro de Reclamaciones virtual. Su registro no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.</p>

        <div className="proveedor">
          <h2 className="seccion">Proveedor del servicio</h2>
          <p><b>SmartdeskApps</b> · RUC 10490217644</p>
          <p>Servicios: Kaserita (punto de venta) y KaseritaDelivery (tienda virtual). Operación 100% virtual, sin oficina de atención al público.</p>
          <p>Contacto: smartdeskapps@smartdeskapps.com · Fecha del reclamo: {fechaHoy()}</p>
        </div>

        <form onSubmit={enviar}>
          <input type="text" name="web" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.web} onChange={set('web')} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
          <h2 className="seccion">1. Identificación del consumidor reclamante</h2>
          <div className="field">
            <label>Nombre completo *</label>
            <input maxLength={200} value={form.nombre_completo} onChange={set('nombre_completo')} required />
          </div>
          <div className="field">
            <label>DNI / Carné de extranjería *</label>
            <input maxLength={20} inputMode="text" autoComplete="off" value={form.documento_identidad} onChange={set('documento_identidad')} required />
          </div>
          <div className="field">
            <label>Domicilio</label>
            <input maxLength={300} value={form.domicilio} onChange={set('domicilio')} />
          </div>
          <div className="row2">
            <div className="field">
              <label>Teléfono</label>
              <input maxLength={30} value={form.telefono} onChange={set('telefono')} />
            </div>
            <div className="field">
              <label>Correo electrónico *</label>
              <input type="email" maxLength={200} value={form.email} onChange={set('email')} required />
            </div>
          </div>
          <label className="checkbox-line">
            <input type="checkbox" checked={form.es_menor_edad} onChange={set('es_menor_edad')} />
            <span>El reclamante es menor de edad (reclamo presentado por su apoderado)</span>
          </label>

          <h2 className="seccion">2. Identificación del bien contratado</h2>
          <div className="field">
            <label>Producto o servicio (ej. plan mensual, catálogo online)</label>
            <input maxLength={300} value={form.bien_contratado} onChange={set('bien_contratado')} />
          </div>
          <div className="field">
            <label>Monto reclamado (S/)</label>
            <input type="number" min="0" max="1000000" step="0.01" value={form.monto_reclamado} onChange={set('monto_reclamado')} />
          </div>

          <h2 className="seccion">3. Detalle de la reclamación</h2>
          <div className="field">
            <label>Tipo *</label>
            <div className="tipo-row">
              <label className={`tipo-opt ${form.tipo === 'reclamo' ? 'sel' : ''}`}>
                <input type="radio" name="tipo" value="reclamo" checked={form.tipo === 'reclamo'} onChange={set('tipo')} />
                Reclamo <span>Disconformidad con el producto o servicio</span>
              </label>
              <label className={`tipo-opt ${form.tipo === 'queja' ? 'sel' : ''}`}>
                <input type="radio" name="tipo" value="queja" checked={form.tipo === 'queja'} onChange={set('tipo')} />
                Queja <span>Malestar no relacionado al producto/servicio en sí (ej. atención)</span>
              </label>
            </div>
          </div>
          <div className="field">
            <label>Detalle *</label>
            <textarea rows="4" maxLength={5000} value={form.detalle} onChange={set('detalle')} required />
          </div>
          <div className="field">
            <label>Pedido del consumidor *</label>
            <textarea rows="3" maxLength={5000} value={form.pedido} onChange={set('pedido')} required placeholder="¿Qué solución esperas?" />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="pay-btn" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Enviar reclamo'}
          </button>
          <p className="fine-print">Al enviar, aceptas que tratemos estos datos únicamente para atender tu reclamo, conforme a nuestra <a href="/privacidad">Política de Privacidad</a>.</p>
        </form>
      </div>
      <a className="back" href="/">← Volver a Kaserita</a>
    </div>
  );
}

function Topbar() {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M4 9L12 4l8 5v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1V9z" fill="#fff"/></svg></div>
        <div className="brand-name">Kaser<span>ita</span></div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
