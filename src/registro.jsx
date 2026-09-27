import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hzmrsbeamtbloudmxjrp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw";
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Por ahora el alta de cuentas es manual: el botón "Continuar" abre WhatsApp
// con el plan elegido y el equipo activa la cuenta (el pago es por Yape).
const WHATSAPP_ALTAS = '51900376462';

function Faq() {
  const [abierto, setAbierto] = useState(0);
  const preguntas = [
    { q: '¿Necesito instalar algo?', a: 'No. Kaserita funciona desde el navegador, en tu celular, tablet o PC. No hay nada que descargar ni instalar.' },
    { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Es un pago por mes, sin contrato ni permanencia. Si no quieres seguir, simplemente no vuelves a pagar el mes siguiente.' },
    { q: '¿Cómo pago?', a: 'Por Yape. Al continuar se abre WhatsApp con tu plan; te respondemos, te indicamos cómo pagar tu primer mes y activamos tu cuenta. Kaserita no guarda datos bancarios.' },
    { q: '¿Puedo empezar con Punto de Venta y sumar el catálogo después?', a: 'Sí, puedes arrancar con el plan que necesites hoy y ampliarlo más adelante sin perder tus productos ni tu historial de ventas.' },
    { q: '¿Qué necesito para activar mi cuenta?', a: 'Solo escribirnos por WhatsApp. Te pediremos los datos básicos de tu negocio (nombre, DNI y celular) y tu pago por Yape.' },
  ];
  return (
    <div className="faq">
      {preguntas.map((p, i) => (
        <div key={i} className={`faq-item ${abierto === i ? 'open' : ''}`}>
          <button type="button" className="faq-q" onClick={() => setAbierto(abierto === i ? -1 : i)}>
            {p.q}
            <svg className="ic" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>
          </button>
          <div className="faq-a"><p>{p.a}</p></div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [paso, setPaso] = useState('cargando'); // cargando | plan | ya-tiene
  const [sesionGoogle, setSesionGoogle] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [planElegido, setPlanElegido] = useState(null);

  useEffect(() => {
    sbClient.from('planes_kaserita').select('*').eq('activo', true).order('precio_soles').then(({ data }) => {
      setPlanes(data || []);
      setPlanElegido((p) => p || (data && data[1]?.id) || (data && data[0]?.id) || null);
    });
  }, []);

  // Si llega con una sesión de Google que ya tiene bodega, no hace falta
  // registrarse de nuevo.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) { setPaso('plan'); return; }
      setSesionGoogle(session);
      const { data: yaTiene } = await sbClient.rpc('tengo_bodega');
      setPaso(yaTiene ? 'ya-tiene' : 'plan');
    })();
  }, []);

  // Vía de salida para quien entró con Google pero no tiene suscripción:
  // sin esto, la sesión queda guardada y vuelve a caer acá en cada visita.
  const cerrarSesionYVolver = async () => {
    await sbClient.auth.signOut();
    window.location.href = '/';
  };

  const planActual = planes.find((p) => p.id === planElegido);

  // Abre WhatsApp con el plan elegido y el precio de la promo (si tiene).
  const continuarPorWhatsApp = () => {
    if (!planActual) return;
    const precio = Number(planActual.precio_soles_promo || planActual.precio_soles).toFixed(2);
    const lineas = ['Hola, quiero crear mi cuenta en Kaserita.', `Plan: ${planActual.nombre}`];
    if (planActual.precio_soles_promo != null) {
      lineas.push(`Promo: S/ ${precio} al mes en mis primeros ${planActual.meses_promo} pagos (después S/ ${Number(planActual.precio_soles).toFixed(2)}).`);
    } else {
      lineas.push(`Precio: S/ ${precio} al mes.`);
    }
    window.open(`https://wa.me/${WHATSAPP_ALTAS}?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M4 9L12 4l8 5v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1V9z" fill="#fff"/></svg></div>
          <div className="brand-name">Kaser<span>ita</span></div>
        </div>
        <div className="topbar-note"><svg className="ic" viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg> Activación por WhatsApp</div>
      </div>

      {sesionGoogle && paso !== 'cargando' && (
        <div className="session-note">
          Conectado como {sesionGoogle.user?.email} ·{' '}
          <button type="button" onClick={cerrarSesionYVolver}>Cerrar sesión</button>
        </div>
      )}

      {paso === 'plan' && (
        <div className="hero">
          <span className="eyebrow"><svg className="ic" viewBox="0 0 16 16"><path d="M2 7l6-4 6 4M3 7v6h10V7M6.5 13V9h3v4"/></svg> Para tu negocio</span>
          <h1>Activa tu negocio en <em>Kaserita</em> hoy mismo</h1>
          <p className="hero-sub">Elige tu plan, escríbenos por WhatsApp y arranca a vender — sin contrato, sin instalar nada.</p>
          <div className="trust-row">
            <span className="trust-item"><svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M5.3 8.2l1.8 1.8 3.6-3.6"/></svg> Te atendemos por WhatsApp</span>
            <span className="trust-item"><svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M5.3 8.2l1.8 1.8 3.6-3.6"/></svg> Cancelas cuando quieras</span>
          </div>
        </div>
      )}

      <div className="card screen">
        {paso === 'cargando' && (
          <div className="center-block"><div className="spinner"></div></div>
        )}

        {paso === 'plan' && (
          <>
            <h2>Elige tu plan</h2>
            <p className="screen-sub">Puedes sumar Catálogo Online más adelante sin perder nada de lo que ya cargaste.</p>
            <div className="plans">
              {planes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`plan ${planElegido === p.id ? 'selected' : ''}`}
                  onClick={() => setPlanElegido(p.id)}
                >
                  <div className="plan-check"><svg className="ic" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg></div>
                  <div className="plan-body">
                    <div className="plan-top-row">
                      <span className="plan-name">
                        {p.nombre}
                        {p.permite_delivery && <span className="plan-badge">Más elegido</span>}
                      </span>
                      <span className="plan-price">
                        S/ {Number(p.precio_soles_promo || p.precio_soles).toFixed(2)}<small> /mes</small>
                      </span>
                    </div>
                    {p.precio_soles_promo != null ? (
                      <p className="plan-promo">
                        <svg className="ic ic-fill" viewBox="0 0 16 16"><path d="M8 1l1.2 4.8L14 7l-4.8 1.2L8 13l-1.2-4.8L2 7l4.8-1.2L8 1z"/></svg>
                        Precio de tus primeros {p.meses_promo} pagos — después S/ {Number(p.precio_soles).toFixed(2)}
                      </p>
                    ) : (
                      <p className="plan-desc">Caja, ventas, turnos, stock y clientes.</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="pay-btn" disabled={!planActual} onClick={continuarPorWhatsApp}>
              <svg className="ic" viewBox="0 0 16 16"><path d="M2 13.5l.9-3.1A6 6 0 1 1 5.6 13L2 13.5z"/><path d="M6 6c0 2.2 1.8 4 4 4l.9-1-1.5-.9-.6.5c-.8-.3-1.4-.9-1.7-1.7l.5-.6L6.7 4.8 6 6z"/></svg>
              Continuar por WhatsApp
            </button>
            <p className="fine-print">Se abre WhatsApp con tu plan; te respondemos, coordinamos el pago por Yape y activamos tu cuenta. No guardamos datos bancarios.</p>
          </>
        )}

        {paso === 'ya-tiene' && (
          <div className="center-block">
            <div className="success-badge"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg></div>
            <h2>Ya tienes una bodega activa</h2>
            <p className="screen-sub">Esta cuenta de Google ya tiene una bodega creada en Kaserita -- no hace falta registrarte de nuevo.</p>
            <a href="/pos" className="pay-btn" style={{ textDecoration: 'none', marginTop: 6 }}>Entrar a mi panel</a>
          </div>
        )}
      </div>

      {paso === 'plan' && (
        <>
          <div className="section">
            <h2 className="section-title">Todo lo que tu negocio necesita</h2>
            <p className="section-sub">Pensado para el día a día de un negocio peruano, sin vueltas.</p>
            <div className="benefits">
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><rect x="2" y="6" width="12" height="8" rx="1.5"/><path d="M5 6V4a3 3 0 016 0v2"/></svg></div>
                <h3>Caja en segundos</h3>
                <p>Cobra e imprime o comparte el ticket sin vueltas ni papeleo.</p>
              </div>
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M2 8h12M8 1.7c1.6 1.8 2.5 4 2.5 6.3s-.9 4.5-2.5 6.3c-1.6-1.8-2.5-4-2.5-6.3S6.4 3.5 8 1.7z"/></svg></div>
                <h3>Catálogo online</h3>
                <p>Tu propia vitrina para recibir pedidos por WhatsApp.</p>
              </div>
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><path d="M2 13V9M6 13V5M10 13V7M14 13V3"/></svg></div>
                <h3>Reportes claros</h3>
                <p>Mira cuánto vendiste hoy y qué productos se mueven más.</p>
              </div>
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><circle cx="6" cy="5.5" r="2.3"/><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><circle cx="12" cy="6" r="1.8"/><path d="M10.8 10.3c1.8.3 3.2 1.6 3.2 3.7"/></svg></div>
                <h3>Varios cajeros</h3>
                <p>Suma cajeros con su propio PIN y controla cada turno.</p>
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Cómo funciona</h2>
            <p className="section-sub">Tres pasos y ya estás vendiendo.</p>
            <div className="how-steps">
              <div className="how-step">
                <div className="how-num">1</div>
                <div className="how-text"><strong>Eliges tu plan</strong><span>Con el precio de promo a la vista y sin contrato.</span></div>
              </div>
              <div className="how-step">
                <div className="how-num">2</div>
                <div className="how-text"><strong>Nos escribes por WhatsApp</strong><span>Coordinamos el pago del mes por Yape.</span></div>
              </div>
              <div className="how-step">
                <div className="how-num">3</div>
                <div className="how-text"><strong>Activamos tu cuenta</strong><span>Con los datos de tu negocio, y a vender.</span></div>
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Preguntas frecuentes</h2>
            <p className="section-sub">Lo que más preguntan antes de empezar.</p>
            <Faq />
          </div>

          <div className="section">
            <div className="cta-banner">
              <h3>¿List@ para activar tu negocio?</h3>
              <p>Elige tu plan arriba y arranca hoy mismo.</p>
              <button type="button" className="google-btn" disabled={!planActual} onClick={continuarPorWhatsApp}>
                Continuar por WhatsApp
              </button>
            </div>
          </div>
        </>
      )}

      <footer>Kaserita © 2026 — hecho para bodegas peruanas</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
