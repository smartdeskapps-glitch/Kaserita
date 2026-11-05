// Compara el HTML que dibujan dos builds del POS (por ejemplo antes y después de un
// refactor) en los mismos estados: login, catálogo, carrito, búsqueda, menú y varias
// ventanas, en Bodega Demo y sin tocar Supabase. Si un refactor no cambia lo que se
// ve, todo debe salir IGUAL. Uso:
//   node scripts/comparar-render.cjs <dist-antes> <dist-despues>
// Requiere Playwright con Chromium.
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const [A,B]=process.argv.slice(2);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const servir=(root,port)=>new Promise(ok=>{const s=http.createServer((q,r)=>{let u=q.url.split('?')[0];if(u==='/pos')u='/pos.html';const f=path.join(root,u);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(port,()=>ok(s));});
const limpiar=h=>h.replace(/B\d{3}-\d+/g,'B###').replace(/\d{1,2}:\d{2}/g,'HH:MM').replace(/\d+ (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z.]* \d{4}/g,'FECHA').replace(/style="[^"]*animation-delay[^"]*"/g,'');
async function capturar(port,conSesion){const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:850}});const p=await ctx.newPage();p.setDefaultTimeout(8000);
 await p.route(/supabase\.co|googleapis|gstatic|cdnjs|pixabay/,r=>r.abort());
 await p.addInitScript(()=>{Date.now=(()=>{const t0=1767225600000;let k=0;return()=>t0+(k++);})();Math.random=(()=>{let s=1;return()=>{s=(s*16807)%2147483647;return s/2147483647;};})();});
 if(conSesion)await p.addInitScript(()=>{const DEMO='a0000000-0000-0000-0000-000000000001';
  localStorage.setItem('sb-hzmrsbeamtbloudmxjrp-auth-token',JSON.stringify({access_token:'x',token_type:'bearer',refresh_token:'r',expires_in:3600,expires_at:4102444800,user:{id:'u1',aud:'authenticated',role:'authenticated'}}));
  localStorage.setItem('kz_sesion_ultima',JSON.stringify({usuario:{id:'us1',auth_id:'u1',bodega_id:DEMO,nombre:'Dueño Demo',rol:'dueno',activo:true},bodega:{id:DEMO,nombre:'Bodega Demo',activa:true,slug:'bodega-demo',delivery_permitido:true}}));});
 const fotos={};const foto=async(k)=>{await p.waitForTimeout(900);fotos[k]=limpiar(await p.evaluate(()=>document.getElementById('root').innerHTML));};
 await p.goto('http://localhost:'+port+'/pos');
 if(!conSesion){await p.waitForSelector('text=Continuar con Google');await foto('login');}
 else{await p.waitForSelector('input[placeholder*="scanea"]',{timeout:90000});await foto('catalogo');
  const c=p.locator('.kc.kc-pos');for(let i=0;i<3;i++)await c.nth(i).click();await foto('carrito');
  await p.fill('input[placeholder*="scanea"]','leche');await foto('busqueda');await p.fill('input[placeholder*="scanea"]','');
  const abrir=async(t)=>{await p.locator('button[aria-label="Más opciones"]').first().dispatchEvent('click');await p.waitForTimeout(300);await foto('menu');const i=p.locator('input[placeholder="Buscar una opción..."]').first();await i.fill(t);await i.press('Enter');};
  for(const t of ['Fiados','Combos','Registrar merma','Cajeros y Empleados','Dashboard de Ventas','Abrir Turno']){await abrir(t);await foto('v:'+t);await p.keyboard.press('Escape');await p.waitForTimeout(300);await p.keyboard.press('Escape');}
  await p.getByRole('button',{name:'Cobrar',exact:false}).last().click().catch(()=>{});await foto('cobro');}
 await b.close();return fotos;}
(async()=>{const sa=await servir(A,4301),sb=await servir(B,4302);
 for(const conSesion of [false,true]){const fa=await capturar(4301,conSesion),fb=await capturar(4302,conSesion);
  for(const k of Object.keys(fa)){const iguales=fa[k]===fb[k];let detalle='';if(!iguales){let i=0;while(fa[k][i]===fb[k][i])i++;detalle=' primera diferencia en '+i+': ANTES «'+fa[k].slice(i-60,i+80)+'» DESPUÉS «'+fb[k].slice(i-60,i+80)+'»';}
   console.log((iguales?'IGUAL     ':'DISTINTO  ')+k.padEnd(28)+' '+fa[k].length+' / '+fb[k].length+' bytes'+detalle);}}
 sa.close();sb.close();})();
