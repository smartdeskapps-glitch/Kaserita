import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hzmrsbeamtbloudmxjrp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw";
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Por ahora el alta de cuentas es manual: el botón "Continuar" abre WhatsApp
// con el plan elegido y el equipo activa la cuenta (el pago es por Yape o con
// un link de pago de Izipay de un solo uso que el equipo envía por WhatsApp).
const WHATSAPP_ALTAS = '51900376462';

const dinero = (n) => `S/ ${Number(n).toFixed(2)}`;
const precioHoy = (plan) => Number(plan.precio_soles_promo ?? plan.precio_soles);
const etiquetaPlan = (plan) => (plan.permite_delivery ? 'POS + Catálogo' : 'Punto de Venta');
const beneficiosPlan = (plan) =>
  plan.permite_delivery
    ? ['Todo el POS', 'Tienda virtual', 'Pedidos por delivery y retiro', 'Más alcance']
    : ['Ventas', 'Inventario', 'Reportes básicos', 'Control de caja'];

const IconWhatsApp = () => (
  <svg className="wa" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 1 1 6.98 3.86zm4.5-6.13c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.17.25-.64.8-.78.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.1-.23-.17-.48-.29z" />
  </svg>
);

const IconCheck = () => (
  <svg className="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>
);

const Marca = () => (
  <a className="brand" href="/" aria-label="Kaserita - inicio">
    <img className="brand-logo" src="/logo-blanco.webp" width="600" height="470" alt="Kaserita" />
  </a>
);

function Faq() {
  const [abierto, setAbierto] = useState(0);
  const preguntas = [
    { q: '¿Necesito instalar algo o tener internet?', a: 'No hay nada que instalar: Kaserita funciona desde el navegador, en tu celular, tablet o PC. Eso sí, necesita conexión a internet, ya sea wifi o datos del celular.' },
    { q: '¿Funciona con lector de código de barras e impresora de tickets?', a: 'Sí. Puedes escanear tus productos con un lector de código de barras e imprimir el ticket de cada venta en una impresora de tickets.' },
    { q: '¿Cómo pago y cómo se activa mi cuenta?', a: 'Eliges tu plan y se abre WhatsApp con tu mensaje. Te respondemos, te enviamos un link de pago de Izipay para tu primer mes, donde puedes pagar con Yape, Plin o tarjeta, y activamos tu cuenta. Te pediremos los datos básicos de tu negocio: nombre, DNI y celular. Kaserita no guarda datos bancarios.' },
    { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Es un pago por mes, sin contrato ni permanencia. Si no quieres seguir, simplemente no vuelves a pagar el mes siguiente.' },
    { q: '¿Cobran comisión por mis ventas?', a: 'No. Solo pagas la suscripción mensual de tu plan.' },
    { q: '¿Puedo empezar con Punto de Venta y sumar el catálogo después?', a: 'Sí, puedes arrancar con el plan que necesites hoy y ampliarlo más adelante sin perder tus productos ni tu historial de ventas.' },
    { q: '¿Kaserita emite boletas o facturas electrónicas de SUNAT?', a: 'No. Kaserita no está conectado con SUNAT: es una herramienta para gestionar tu negocio (ventas, inventario, caja y clientes), no un sistema de facturación electrónica.' },
  ];
  return (
    <div className="faq">
      {preguntas.map((p, i) => (
        <div key={i} className={`faq-item ${abierto === i ? 'open' : ''}`}>
          <button type="button" className="faq-q" aria-expanded={abierto === i} onClick={() => setAbierto(abierto === i ? -1 : i)}>
            {p.q}
            <svg className="ic" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" /></svg>
          </button>
          <div className="faq-a"><p>{p.a}</p></div>
        </div>
      ))}
    </div>
  );
}

// Conteo anónimo de visitas a /registro y del clic en "Continuar por
// WhatsApp" (ver analitica_eventos.sql). No identifica a nadie: cada
// llamada es solo "se abrió esta página" o "se tocó este botón, con este
// plan", sin nada que junte dos visitas de la misma persona. Si falla
// (bloqueador de anuncios, sin red) no afecta el registro.
const anotarEvento = (evento, dato) => {
  sbClient.from('analitica_eventos').insert([{ pagina: 'registro', evento, dato: dato || null }]).then(() => {}, () => {});
};

function App() {
  const [paso, setPaso] = useState('cargando'); // cargando | plan | ya-tiene
  const [sesionGoogle, setSesionGoogle] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [planElegido, setPlanElegido] = useState(null);
  const [negocio, setNegocio] = useState('');

  useEffect(() => { anotarEvento('vista'); }, []);

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

  // Mensaje con el plan elegido, el precio de la promo (si tiene) y, si lo
  // escribió, el nombre del negocio. Es un enlace normal (no window.open) para
  // que no lo bloquee el navegador y se pueda abrir en otra pestaña.
  const urlWhatsApp = (() => {
    if (!planActual) return '#';
    const lineas = ['Hola, quiero crear mi cuenta en Kaserita.', `Plan: ${planActual.nombre}`];
    if (planActual.precio_soles_promo != null) {
      lineas.push(`Promo: ${dinero(precioHoy(planActual))} al mes en mis primeros ${planActual.meses_promo} pagos (después ${dinero(planActual.precio_soles)}).`);
    } else {
      lineas.push(`Precio: ${dinero(precioHoy(planActual))} al mes.`);
    }
    if (negocio.trim()) lineas.push(`Mi negocio: ${negocio.trim()}`);
    return `https://wa.me/${WHATSAPP_ALTAS}?text=${encodeURIComponent(lineas.join('\n'))}`;
  })();
  const alContinuar = () => { if (planActual) anotarEvento('click_whatsapp', planActual.nombre); };

  const pie = (
    <footer>
      <div>Kaserita © 2026 — hecho para negocios peruanos</div>
      <div className="footer-links">
        <a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a> · <a href="/reclamos">Libro de Reclamaciones</a>
      </div>
    </footer>
  );

  if (paso === 'ya-tiene') {
    return (
      <div className="wrap-min">
        <div className="topbar topbar-light"><Marca /></div>
        <div className="card">
          <div className="center-block">
            <div className="success-badge"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 5" /></svg></div>
            <h2>Ya tienes un negocio activo</h2>
            <p className="screen-sub">Esta cuenta de Google ya tiene un negocio creado en Kaserita, así que no hace falta registrarte de nuevo.</p>
            <a href="/pos" className="pay-btn">Entrar a mi panel</a>
          </div>
        </div>
        {pie}
      </div>
    );
  }

  return (
    <>
      <header className="hero">
        <div className="hero-in">
          <div className="topbar">
            <Marca />
            <span className="chip">
              <svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3" /><path d="M5.3 8.2l1.8 1.8 3.6-3.6" /></svg>
              Sin contrato
            </span>
          </div>

          {sesionGoogle && paso !== 'cargando' && (
            <div className="session-note">
              Conectado como {sesionGoogle.user?.email} ·{' '}
              <button type="button" onClick={cerrarSesionYVolver}>Cerrar sesión</button>
            </div>
          )}

          <div className="hero-grid">
            <div className="hero-copy">
              <h1>Elige cómo quieres vender</h1>
              <p className="hero-sub">Escríbenos por WhatsApp con tu plan, paga el primer mes mediante link de pago Izipay (Yape/Plin/tarjeta) y activamos tu cuenta.</p>
              <ul className="trust-row">
                <li><IconCheck /> Sin contrato</li>
                <li><IconCheck /> Sin comisiones por tus ventas</li>
                <li><IconCheck /> Te atendemos por WhatsApp</li>
              </ul>
            </div>

            <div className="panel">
              {paso === 'cargando' || !planActual ? (
                <div className="panel-carga"><div className="spinner"></div><p>Cargando planes…</p></div>
              ) : (
                <>
                  <div className="seg" role="tablist" style={{ gridTemplateColumns: `repeat(${planes.length}, 1fr)` }}>
                    {planes.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="tab"
                        aria-selected={planElegido === p.id}
                        className={planElegido === p.id ? 'on' : ''}
                        onClick={() => setPlanElegido(p.id)}
                      >
                        {etiquetaPlan(p)}
                      </button>
                    ))}
                  </div>
                  <div className="bigprice">{dinero(precioHoy(planActual))}<small> /mes</small></div>
                  <p className="heroline">
                    {planActual.precio_soles_promo != null
                      ? `Precio de tus primeros ${planActual.meses_promo} pagos. Después ${dinero(planActual.precio_soles)} al mes.`
                      : 'Pago mensual, sin comisiones por tus ventas.'}
                  </p>
                  <ul className="checks">
                    {beneficiosPlan(planActual).map((b) => (
                      <li key={b}><IconCheck /> {b}</li>
                    ))}
                  </ul>
                  <label className="field">
                    <span>Nombre de tu negocio <em>(opcional)</em></span>
                    <input type="text" value={negocio} maxLength={60} autoComplete="organization" placeholder="Ej. Bodega San Luis" onChange={(e) => setNegocio(e.target.value)} />
                  </label>
                  <div className="cta-row">
                    <a className="cta" href={urlWhatsApp} target="_blank" rel="noopener noreferrer" onClick={alContinuar}>
                      <IconWhatsApp /> Continuar por WhatsApp
                    </a>
                  </div>
                  <p className="fine fine-d">Se abre WhatsApp con tu plan. Ten a la mano el nombre de tu negocio, tu DNI y tu celular. Pagas mediante link de pago Izipay (Yape/Plin/tarjeta) y activamos tu cuenta.</p>
                  <p className="fine fine-d fine-alt">¿No se abre WhatsApp? Escríbenos al <a href="tel:+51900376462">+51 900 376 462</a>.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <p className="fine fine-m">Se abre WhatsApp con tu plan. Ten a la mano el nombre de tu negocio, tu DNI y tu celular. Pagas mediante link de pago Izipay (Yape/Plin/tarjeta) y activamos tu cuenta. No guardamos datos bancarios.</p>
        <p className="fine fine-m fine-alt">¿No se abre WhatsApp? Escríbenos al <a href="tel:+51900376462">+51 900 376 462</a>.</p>

        <section className="sec">
          <h2 className="sec-title">Cómo funciona</h2>
          <div className="minis">
            <div className="mini">
              <div className="dot"><IconWhatsApp /></div>
              <b>Escribes</b>
              <span>El mensaje ya sale escrito con tu plan</span>
            </div>
            <div className="mini">
              <div className="dot"><svg className="ic" viewBox="0 0 16 16"><rect x="4" y="1.8" width="8" height="12.4" rx="2" /><path d="M7 12h2" /></svg></div>
              <b>Pagas</b>
              <span>Mediante link de pago Izipay (Yape/Plin/tarjeta)</span>
            </div>
            <div className="mini">
              <div className="dot"><IconCheck /></div>
              <b>Vendes</b>
              <span>Activamos tu cuenta con los datos de tu negocio</span>
            </div>
          </div>
        </section>

        <section className="sec sec-faq">
          <h2 className="sec-title">Preguntas frecuentes</h2>
          <p className="sec-sub">Lo que más preguntan antes de empezar.</p>
          <Faq />
        </section>

        {pie}
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
