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
};

function generarCodigo() {
  const y = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RC-${y}-${rand}`;
}

export default function App() {
  const [form, setForm] = useState(vacio);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState(null);

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
    setEnviando(true);
    try {
      const codigoGenerado = generarCodigo();
      const { error: errIns } = await sbClient.from('libro_reclamaciones').insert([{
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
      }]);
      if (errIns) throw errIns;
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
          <p className="screen-sub">Guarda este código. Te responderemos al correo indicado en un plazo máximo de 30 días calendario, conforme al Código de Protección y Defensa del Consumidor.</p>
          <a className="back" href="/">← Volver a Kaserita</a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <Topbar />
      <div className="card">
        <h1>Libro de Reclamaciones</h1>
        <p className="screen-sub">Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, este establecimiento cuenta con un Libro de Reclamaciones virtual. Su registro no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.</p>

        <form onSubmit={enviar}>
          <h2 className="seccion">1. Identificación del consumidor reclamante</h2>
          <div className="field">
            <label>Nombre completo *</label>
            <input value={form.nombre_completo} onChange={set('nombre_completo')} required />
          </div>
          <div className="field">
            <label>DNI / Carné de extranjería *</label>
            <input value={form.documento_identidad} onChange={set('documento_identidad')} required />
          </div>
          <div className="field">
            <label>Domicilio</label>
            <input value={form.domicilio} onChange={set('domicilio')} />
          </div>
          <div className="row2">
            <div className="field">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={set('telefono')} />
            </div>
            <div className="field">
              <label>Correo electrónico *</label>
              <input type="email" value={form.email} onChange={set('email')} required />
            </div>
          </div>
          <label className="checkbox-line">
            <input type="checkbox" checked={form.es_menor_edad} onChange={set('es_menor_edad')} />
            <span>El reclamante es menor de edad (reclamo presentado por su apoderado)</span>
          </label>

          <h2 className="seccion">2. Identificación del bien contratado</h2>
          <div className="field">
            <label>Producto o servicio (ej. plan mensual, catálogo online)</label>
            <input value={form.bien_contratado} onChange={set('bien_contratado')} />
          </div>
          <div className="field">
            <label>Monto reclamado (S/)</label>
            <input type="number" min="0" step="0.01" value={form.monto_reclamado} onChange={set('monto_reclamado')} />
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
            <textarea rows="4" value={form.detalle} onChange={set('detalle')} required />
          </div>
          <div className="field">
            <label>Pedido del consumidor *</label>
            <textarea rows="3" value={form.pedido} onChange={set('pedido')} required placeholder="¿Qué solución esperas?" />
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
