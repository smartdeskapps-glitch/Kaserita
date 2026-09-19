import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hzmrsbeamtbloudmxjrp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_RHAkd7pZIadDnSQClFdjMQ_lrG3p-gw";
const sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Public key de Culqi de PRUEBA -- reemplazar por la pk_live_ real al salir
// de pruebas. La secret key nunca va acá, vive como secreto de la Edge
// Function cobrar-plan-culqi.
const CULQI_PUBLIC_KEY = 'pk_test_sm8WLbJ2rsv9Y8ee';

function cargarScriptCulqi() {
  return new Promise((resolve, reject) => {
    if (window.CulqiCheckout) return resolve();
    const script = document.createElement('script');
    script.src = 'https://js.culqi.com/checkout-js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Culqi.'));
    document.head.appendChild(script);
  });
}

const IconGoogle = () => (
  <svg viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17 10.3l-.7.4z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 35.3 27 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.9 39.5 16.4 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.6 5.4C41.6 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);

function Stepper({ paso }) {
  const n = paso === 'plan' || paso === 'google' ? 1 : paso === 'pago' || paso === 'procesando' ? 2 : 3;
  return (
    <div className="stepper">
      <div className={`step ${n > 1 ? 'done' : 'active'}`}><div className="step-dot">{n > 1 ? '✓' : '1'}</div><span className="step-label">Plan</span></div>
      <div className={`step-line ${n > 1 ? 'filled' : ''}`}></div>
      <div className={`step ${n > 2 ? 'done' : n === 2 ? 'active' : ''}`}><div className="step-dot">{n > 2 ? '✓' : '2'}</div><span className="step-label">Pago</span></div>
      <div className={`step-line ${n > 2 ? 'filled' : ''}`}></div>
      <div className={`step ${n === 3 ? 'active' : ''}`}><div className="step-dot">3</div><span className="step-label">Tu bodega</span></div>
    </div>
  );
}

function Faq() {
  const [abierto, setAbierto] = useState(0);
  const preguntas = [
    { q: '¿Necesito instalar algo?', a: 'No. Kaserita funciona desde el navegador, en tu celular, tablet o PC. No hay nada que descargar ni instalar.' },
    { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Es un pago por mes, sin contrato ni permanencia. Si no querés seguir, simplemente no volvés a pagar el mes siguiente.' },
    { q: '¿Mis datos de tarjeta quedan guardados en Kaserita?', a: 'No. El pago se procesa directo con Culqi, una pasarela de pago certificada -- tu número de tarjeta nunca pasa por nuestros servidores.' },
    { q: '¿Puedo empezar con Punto de Venta y sumar el catálogo después?', a: 'Sí, podés arrancar con el plan que necesites hoy y ampliarlo más adelante sin perder tus productos ni tu historial de ventas.' },
    { q: '¿Qué necesito para activar mi cuenta?', a: 'Solo tu cuenta de Google, una tarjeta para el pago, y los datos básicos de tu bodega (nombre, DNI y celular). Todo el proceso toma un par de minutos.' },
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
  const [paso, setPaso] = useState('cargando'); // cargando | plan | google | pago | procesando | bodega | listo | ya-tiene
  const [sesionGoogle, setSesionGoogle] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [planElegido, setPlanElegido] = useState(null);
  const [error, setError] = useState('');
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [nombreBodega, setNombreBodega] = useState('');
  const [dni, setDni] = useState('');
  const [celular, setCelular] = useState('');
  const [bodegaCreada, setBodegaCreada] = useState('');
  const [retomando, setRetomando] = useState(false);

  useEffect(() => {
    sbClient.from('planes_kaserita').select('*').eq('activo', true).order('precio_soles').then(({ data }) => {
      setPlanes(data || []);
      setPlanElegido((p) => p || (data && data[1]?.id) || (data && data[0]?.id) || null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) { setPaso('plan'); return; }
      setSesionGoogle(session);
      const { data: yaTiene } = await sbClient.rpc('tengo_bodega');
      if (yaTiene) { setPaso('ya-tiene'); return; }
      const { data: pendiente } = await sbClient.rpc('mi_pago_pendiente').maybeSingle();
      if (pendiente) {
        setRetomando(true);
        setPlanElegido(pendiente.plan_id);
        setPaso('bodega');
      } else {
        // Si ya eligió un plan antes de ir a Google (el flujo normal:
        // plan -> Google -> pago), retoma directo en "pago". Pero si llegó
        // acá ya autenticado sin haber pasado por "Elegí tu plan" (ej.
        // redirigido desde el login normal de la POS por no tener bodega),
        // no hay que saltarse esa elección -- se le muestra el plan igual,
        // ya sin pedirle Google de nuevo (ver continuarDesdePlan).
        const planGuardado = localStorage.getItem('kaserita_registro_plan');
        if (planGuardado) {
          setPlanElegido(planGuardado);
          setPaso('pago');
        } else {
          setPaso('plan');
        }
      }
    })();
  }, []);

  const entrarConGoogle = async () => {
    if (!planElegido) return;
    localStorage.setItem('kaserita_registro_plan', planElegido);
    setPaso('google');
    await sbClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/registro' },
    });
  };

  // Botón del paso "Elegí tu plan": si ya está autenticado (llegó con
  // sesión de Google ya abierta), no hace falta mandarlo a Google de
  // nuevo -- pasa directo a pago con el plan que acaba de elegir.
  const continuarDesdePlan = () => {
    if (!planElegido) return;
    localStorage.setItem('kaserita_registro_plan', planElegido);
    if (sesionGoogle) {
      setPaso('pago');
    } else {
      entrarConGoogle();
    }
  };

  const planActual = planes.find((p) => p.id === planElegido);

  const pagar = async () => {
    if (!planActual) return;
    setError('');
    try {
      await cargarScriptCulqi();
      const config = {
        settings: {
          title: 'Kaserita',
          currency: 'PEN',
          amount: Math.round(Number(planActual.precio_soles_promo || planActual.precio_soles) * 100),
        },
        client: { email: sesionGoogle?.user?.email || '' },
        options: {
          lang: 'auto',
          modal: true,
          paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
        },
      };
      const culqiCheckout = new window.CulqiCheckout(CULQI_PUBLIC_KEY, config);
      culqiCheckout.culqi = async () => {
        if (!culqiCheckout.token) {
          setError(culqiCheckout.error?.user_message || 'No se pudo procesar la tarjeta.');
          return;
        }
        setPaso('procesando');
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/cobrar-plan-culqi`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${sesionGoogle.access_token}`,
            },
            body: JSON.stringify({ culqi_token: culqiCheckout.token.id, plan_id: planElegido }),
          });
          const data = await resp.json();
          culqiCheckout.close();
          if (!resp.ok) throw new Error(data.error || 'No se pudo procesar el pago.');
          localStorage.removeItem('kaserita_registro_plan');
          setPaso('bodega');
        } catch (err) {
          setError(err.message);
          setPaso('pago');
        }
      };
      culqiCheckout.open();
    } catch (err) {
      setError(err.message);
    }
  };

  const crearBodega = async (e) => {
    e.preventDefault();
    setError('');
    if (!nombreBodega.trim()) return setError('Ingresá el nombre de tu bodega.');
    if (!/^\d{8}$/.test(dni.trim())) return setError('El DNI debe tener 8 dígitos.');
    if (!/^\d{9}$/.test(celular.trim())) return setError('El celular debe tener 9 dígitos.');
    setCargandoAccion(true);
    try {
      const { error: errRpc } = await sbClient.rpc('crear_bodega_post_pago', {
        p_nombre_bodega: nombreBodega.trim(),
        p_dni: dni.trim(),
        p_celular: celular.trim(),
      });
      if (errRpc) throw errRpc;
      setBodegaCreada(nombreBodega.trim());
      setPaso('listo');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoAccion(false);
    }
  };

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M4 9L12 4l8 5v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1V9z" fill="#fff"/></svg></div>
          <div className="brand-name">Kaser<span>ita</span></div>
        </div>
        <div className="topbar-note"><svg className="ic" viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg> Pago seguro con Culqi</div>
      </div>

      {(paso === 'plan' || paso === 'google') && (
        <div className="hero">
          <span className="eyebrow"><svg className="ic" viewBox="0 0 16 16"><path d="M2 7l6-4 6 4M3 7v6h10V7M6.5 13V9h3v4"/></svg> Para tu bodega</span>
          <h1>Activá tu bodega en <em>Kaserita</em> hoy mismo</h1>
          <p className="hero-sub">Elegí tu plan, pagá con tarjeta y arrancá a vender en minutos — sin contrato, sin instalar nada.</p>
          <div className="trust-row">
            <span className="trust-item"><svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M5.3 8.2l1.8 1.8 3.6-3.6"/></svg> Activación inmediata</span>
            <span className="trust-item"><svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M5.3 8.2l1.8 1.8 3.6-3.6"/></svg> Cancelás cuando quieras</span>
          </div>
        </div>
      )}

      {paso !== 'plan' && paso !== 'google' && paso !== 'cargando' && paso !== 'ya-tiene' && <Stepper paso={paso} />}

      <div className="card screen">
        {paso === 'cargando' && (
          <div className="center-block"><div className="spinner"></div></div>
        )}

        {paso === 'plan' && (
          <>
            <h2>Elegí tu plan</h2>
            <p className="screen-sub">Podés sumar Catálogo Online más adelante sin perder nada de lo que ya cargaste.</p>
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
            {error && <p className="error-box">{error}</p>}
            <button type="button" className="google-btn" disabled={!planElegido} onClick={continuarDesdePlan}>
              {sesionGoogle ? 'Continuar' : (<><IconGoogle /> Continuar con Google</>)}
            </button>
            <p className="fine-print">Usamos tu cuenta de Google para crear tu acceso — nunca publicamos nada, ni vemos tu contraseña.</p>
          </>
        )}

        {paso === 'google' && (
          <div className="center-block">
            <div className="spinner"></div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Conectando con tu cuenta de Google…</p>
          </div>
        )}

        {paso === 'pago' && planActual && (
          <>
            <h2>Confirmá tu pago</h2>
            <p className="screen-sub">Se cobra hoy y se renueva cada mes mientras tu bodega siga activa.</p>
            <div className="account-chip">
              <div className="avatar">
                {sesionGoogle?.user?.user_metadata?.avatar_url ? (
                  <img src={sesionGoogle.user.user_metadata.avatar_url} alt="" />
                ) : (
                  (sesionGoogle?.user?.user_metadata?.full_name || sesionGoogle?.user?.email || '?').charAt(0).toUpperCase()
                )}
              </div>
              <div className="account-chip-text">
                <strong>{sesionGoogle?.user?.user_metadata?.full_name || 'Tu cuenta'}</strong>
                <span>{sesionGoogle?.user?.email}</span>
              </div>
            </div>
            <div className="pay-summary">
              <div className="pay-summary-left">
                <strong>{planActual.nombre}</strong>
                <span>Pago mensual, cancelás cuando quieras</span>
              </div>
              <div className="pay-summary-price">S/ {Number(planActual.precio_soles_promo || planActual.precio_soles).toFixed(2)}</div>
            </div>
            {error && <p className="error-box">{error}</p>}
            <button type="button" className="pay-btn" onClick={pagar}>
              <svg className="ic" viewBox="0 0 16 16"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M1.5 6.5h13"/></svg>
              Pagar con Tarjeta o Yape
            </button>
            <p className="fine-print"><svg className="ic" viewBox="0 0 16 16"><path d="M8 1.5l5.5 2v4c0 4-2.5 6.3-5.5 7-3-.7-5.5-3-5.5-7v-4l5.5-2z"/></svg> Con tarjeta o Yape -- se procesa directo con Culqi, nunca pasa por nuestros servidores.</p>
          </>
        )}

        {paso === 'procesando' && (
          <div className="center-block">
            <div className="spinner"></div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Procesando tu pago…</p>
          </div>
        )}

        {paso === 'bodega' && (
          <>
            {retomando ? (
              <>
                <h2>Retomá tu registro</h2>
                <p className="screen-sub">Ya confirmamos tu pago anterior — contanos de tu bodega para activar tu cuenta.</p>
              </>
            ) : (
              <>
                <div className="success-badge"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg></div>
                <h2 style={{ textAlign: 'center' }}>¡Pago confirmado!</h2>
                <p className="screen-sub" style={{ textAlign: 'center' }}>Ahora sí, contanos de tu bodega para activar tu cuenta.</p>
              </>
            )}
            <form onSubmit={crearBodega}>
              <div className="field">
                <label>Nombre de tu bodega</label>
                <input type="text" value={nombreBodega} onChange={(e) => setNombreBodega(e.target.value)} placeholder="Ej. Bodega Don Pepe" />
              </div>
              <div className="field">
                <label>DNI</label>
                <input type="text" inputMode="numeric" maxLength={8} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))} placeholder="8 dígitos" />
              </div>
              <div className="field">
                <label>Celular (WhatsApp)</label>
                <div className="input-prefix">
                  <span>+51</span>
                  <input type="tel" inputMode="numeric" maxLength={9} value={celular} onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))} placeholder="987654321" />
                </div>
                <span className="hint">Es el número que va a recibir los pedidos por WhatsApp.</span>
              </div>
              {error && <p className="error-box">{error}</p>}
              <button type="submit" className="pay-btn" disabled={cargandoAccion}>
                {cargandoAccion ? 'Un momento...' : 'Crear mi bodega'}
              </button>
            </form>
          </>
        )}

        {paso === 'listo' && (
          <div className="center-block">
            <div className="success-badge"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg></div>
            <h2>¡{bodegaCreada} ya está activa!</h2>
            <p className="screen-sub">Entrá a tu panel para cargar tus primeros productos.</p>
            <a href="/" className="pay-btn" style={{ textDecoration: 'none', marginTop: 6 }}>Entrar a mi panel</a>
          </div>
        )}

        {paso === 'ya-tiene' && (
          <div className="center-block">
            <div className="success-badge"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.5 3.5L13 5"/></svg></div>
            <h2>Ya tenés una bodega activa</h2>
            <p className="screen-sub">Esta cuenta de Google ya tiene una bodega creada en Kaserita -- no hace falta registrarte de nuevo.</p>
            <a href="/" className="pay-btn" style={{ textDecoration: 'none', marginTop: 6 }}>Entrar a mi panel</a>
          </div>
        )}
      </div>

      {paso === 'plan' && (
        <>
          <div className="section">
            <h2 className="section-title">Todo lo que tu bodega necesita</h2>
            <p className="section-sub">Pensado para el día a día de una bodega peruana, sin vueltas.</p>
            <div className="benefits">
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><rect x="2" y="6" width="12" height="8" rx="1.5"/><path d="M5 6V4a3 3 0 016 0v2"/></svg></div>
                <h3>Caja en segundos</h3>
                <p>Cobrá e imprimí o compartí el ticket sin vueltas ni papeleo.</p>
              </div>
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3"/><path d="M2 8h12M8 1.7c1.6 1.8 2.5 4 2.5 6.3s-.9 4.5-2.5 6.3c-1.6-1.8-2.5-4-2.5-6.3S6.4 3.5 8 1.7z"/></svg></div>
                <h3>Catálogo online</h3>
                <p>Tu propia vitrina para recibir pedidos por WhatsApp.</p>
              </div>
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><path d="M2 13V9M6 13V5M10 13V7M14 13V3"/></svg></div>
                <h3>Reportes claros</h3>
                <p>Mirá cuánto vendiste hoy y qué productos se mueven más.</p>
              </div>
              <div className="benefit">
                <div className="benefit-icon"><svg className="ic" viewBox="0 0 16 16"><circle cx="6" cy="5.5" r="2.3"/><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><circle cx="12" cy="6" r="1.8"/><path d="M10.8 10.3c1.8.3 3.2 1.6 3.2 3.7"/></svg></div>
                <h3>Varios cajeros</h3>
                <p>Sumá cajeros con su propio PIN y controlá cada turno.</p>
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Cómo funciona</h2>
            <p className="section-sub">Tres pasos y ya estás vendiendo.</p>
            <div className="how-steps">
              <div className="how-step">
                <div className="how-num">1</div>
                <div className="how-text"><strong>Elegís tu plan y pagás</strong><span>Pago único por mes con tarjeta, procesado seguro por Culqi.</span></div>
              </div>
              <div className="how-step">
                <div className="how-num">2</div>
                <div className="how-text"><strong>Entrás con tu cuenta de Google</strong><span>Sin contraseñas nuevas que recordar -- tu acceso queda listo al toque.</span></div>
              </div>
              <div className="how-step">
                <div className="how-num">3</div>
                <div className="how-text"><strong>Cargás tu bodega</strong><span>Nombre, DNI y celular -- y tu cuenta queda activa para empezar a vender.</span></div>
              </div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Preguntas frecuentes</h2>
            <p className="section-sub">Lo que más preguntan las bodegas antes de empezar.</p>
            <Faq />
          </div>

          <div className="section">
            <div className="cta-banner">
              <h3>¿List@ para activar tu bodega?</h3>
              <p>Elegí tu plan arriba y arrancá hoy mismo.</p>
              <button type="button" className="google-btn" disabled={!planElegido} onClick={continuarDesdePlan}>
                {sesionGoogle ? 'Continuar' : (<><IconGoogle /> Continuar con Google</>)}
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
