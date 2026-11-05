// Prueba de humo del POS: abre la app compilada en "Bodega Demo" (catálogo local, sin
// tocar Supabase), hace una venta completa y abre cada pantalla del menú. Falla si
// aparece cualquier error de JavaScript. Úsala después de cada refactor grande:
//   npm run build && node scripts/humo-pos.cjs
// Requiere Playwright con Chromium (npm i -D playwright && npx playwright install chromium).
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const root=process.argv[2]||path.join(__dirname,'..','dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const srv=http.createServer((q,r)=>{let u=q.url.split('?')[0];if(u==='/pos')u='/pos.html';const f=path.join(root,u);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}
 r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(4210,async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:850}});const p=await ctx.newPage();p.setDefaultTimeout(5000);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_FAILED|net::/.test(m.text()))errs.push('console: '+m.text().slice(0,200))});
 await p.route(/supabase\.co|googleapis|gstatic|cdnjs|pixabay/,r=>r.abort());
 await p.addInitScript(()=>{const DEMO='a0000000-0000-0000-0000-000000000001';
  localStorage.setItem('sb-hzmrsbeamtbloudmxjrp-auth-token',JSON.stringify({access_token:'x',token_type:'bearer',refresh_token:'r',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'u1',aud:'authenticated',role:'authenticated'}}));
  localStorage.setItem('kz_sesion_ultima',JSON.stringify({usuario:{id:'us1',auth_id:'u1',bodega_id:DEMO,nombre:'Dueño Demo',rol:'dueno',activo:true},bodega:{id:DEMO,nombre:'Bodega Demo',activa:true,slug:'bodega-demo',delivery_permitido:true}}));});
 await p.goto('http://localhost:4210/pos');await p.waitForSelector('input[placeholder*="scanea"]',{timeout:90000});await p.waitForTimeout(1200);
 const pasos=[];const capas=()=>p.evaluate(()=>[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed'&&d.offsetWidth>300&&d.offsetHeight>300).length);
 const paso=async(nombre,fn)=>{const antes=errs.length;const c0=await capas();try{await fn();await p.waitForTimeout(700);const c1=await capas();if(nombre.startsWith('menú')&&c1<=c0)errs.push(nombre+': no se abrió ninguna ventana');}catch(e){errs.push(nombre+': '+e.message.split('\n')[0]);}
   pasos.push((errs.length>antes?'FALLA ':'ok    ')+nombre);await p.keyboard.press('Escape').catch(()=>{});await p.waitForTimeout(250);await p.keyboard.press('Escape').catch(()=>{});await p.waitForTimeout(250);};
 // Catálogo y carrito
 await paso('buscar',async()=>{await p.fill('input[placeholder*="scanea"]','leche');await p.waitForTimeout(400);await p.fill('input[placeholder*="scanea"]','');});
 await paso('agregar 3 al carrito',async()=>{const c=p.locator('.kc.kc-pos');for(let i=0;i<3;i++)await c.nth(i).click();});
 // Venta completa: agregar cajero, abrir turno, cobrar en efectivo.
 const texto=async()=>(await p.locator('body').innerText()).replace(/\s+/g,' ');
 await paso('agregar cajero y abrir turno',async()=>{await p.getByRole('button',{name:/Abrir Turno/}).first().click();await p.waitForTimeout(600);
   await p.getByText('Agregar a alguien que no está en la lista').click();await p.waitForTimeout(400);const ins=p.locator('input:visible');
   await ins.nth(1).fill('Cajera Prueba');await ins.nth(2).fill('12345678');await p.getByRole('button',{name:'Agregar',exact:true}).click();await p.waitForTimeout(600);
   await p.keyboard.press('Escape');await p.waitForTimeout(400);await p.getByRole('button',{name:/Abrir Turno/}).first().click();await p.waitForTimeout(600);
   await p.getByText('Cajera Prueba').first().click();await p.getByRole('button',{name:'Abrir turno',exact:true}).last().click();await p.waitForTimeout(1000);
   if(!/Turno abierto/.test(await texto()))throw new Error('no se abrió el turno');});
 await paso('venta en efectivo',async()=>{await p.getByRole('button',{name:'Cobrar',exact:true}).click();await p.waitForTimeout(600);
   await p.getByRole('button',{name:'Exacto',exact:true}).click();await p.getByRole('button',{name:/Cobrar e imprimir boleta/}).click();await p.waitForTimeout(2000);
   if(!/Venta exitosa/.test(await texto()))throw new Error('no salió la venta exitosa');
   await p.getByRole('button',{name:/Nueva venta/i}).first().click();await p.waitForTimeout(500);});
 const abrir=async(texto)=>{await p.locator('button[aria-label="Más opciones"]').first().dispatchEvent('click');await p.waitForTimeout(300);
   const inp=p.locator('input[placeholder="Buscar una opción..."]').first();await inp.fill(texto);await p.waitForTimeout(150);await inp.press('Enter');};
 for(const op of ['Fiados','Historial','Toma de Inventario','Registrar merma','Dashboard de Ventas','Cuentas por Pagar','Cajeros y Empleados','Registro de actividad','Mi Link de Pedidos','Registrar Productos','Entrada de Mercadería','Combos','Cerrar Caja'])
   await paso('menú: '+op,()=>abrir(op));
 
 // Cada paso debe abrir una ventana: se cuenta cuántas capas fijas hay (sin abrir nada da 0 nuevas).
 console.log(pasos.join('\n'));console.log('ERRORES:',errs.length?errs:'ninguno');
 await b.close();srv.close();process.exit(errs.length?1:0);});
