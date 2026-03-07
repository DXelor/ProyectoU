
const $ = id => document.getElementById(id);
const gv = id => $(id).value.trim();
let chartInst = null;

function showErr(html){ const e=$('err'); e.style.display='block'; e.innerHTML=`<strong>❌</strong> ${html}`; }
function hideErr(){ $('err').style.display='none'; }
function setLoading(on, txt=''){
  $('btn-ai').disabled=on; $('btn-demo').disabled=on;
  $('loader').style.display=on?'flex':'none';
  if(txt) $('loader-txt').textContent=txt;
}

function collectInputs(){
  return {
    title:       gv('title')       || 'E-Book sin título',
    category:    gv('category'),
    price:       parseFloat(gv('price'))     || 9.99,
    pages:       parseInt(gv('pages'))       || 80,
    audience:    gv('audience'),
    platform:    gv('platform'),
    marketing:   parseFloat(gv('marketing')) || 0,
    description: gv('description')           || 'Sin descripción',
    competition: parseInt(gv('competition')),
    audsize:     parseInt(gv('audsize')),
    experience:  parseInt(gv('experience')),
    launchPow:   parseInt(gv('launch')),
    horizon:     parseInt(gv('horizon')),
    notes:       gv('notes') || 'Sin notas',
  };
}

//GROQ IA
//en esta seccion se hace un fetch a la IA Groq con las siguientes peticiones
//tambien le pedimos en un prompt que nos devuelva un archivo Json siguiendo unos parametros con los nombres de las variables
async function runGroq(){
  hideErr();
  const apiKey = gv('apikey');
  if(!apiKey){
    showErr(`Pega tu API Key de Groq arriba o usa el <strong>Modo Demo</strong>. Gratis en
       <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>`);
    return;
  }
  const d = collectInputs();
  const model = gv('groq-model');

  setLoading(true,'Conectando con Groq...');
  $('results-card').style.display='block';
  $('ai-resp').textContent='⏳ Analizando tu producto con Groq AI...';
  $('metrics').style.display='none';
  $('chart-wrap').style.display='none';
  $('demo-banner').style.display='none';

  const prompt=`Eres un experto analista de mercado en productos digitales y e-books. Genera predicción de ventas REALISTA.

PRODUCTO: ${d.title} | Categoría: ${d.category} | Precio: $${d.price} | Páginas: ${d.pages}
Audiencia: ${d.audience} | Plataforma: ${d.platform} | Marketing/mes: $${d.marketing}
Descripción: ${d.description}

MERCADO: Competencia: ${['','Baja','Media','Alta'][d.competition]} | Audiencia propia: ${['ninguna','pequeña','media','grande'][d.audsize]}
Experiencia: ${['ninguna','poca','moderada','alta'][d.experience]} | Lanzamiento: ${['','básico','intermedio','avanzado'][d.launchPow]}
Horizonte: ${d.horizon} meses | Notas: ${d.notes}

Responde SOLO JSON puro sin backticks:
{"ventas_mes":[exactamente ${d.horizon} enteros],"ingresos_mes":[exactamente ${d.horizon} decimales],"total_ventas":entero,"total_ingresos":decimal,"conversion_rate":decimal,"roi":decimal,"analisis":"3 parrafos separados \\n\\n","recomendaciones":["r1","r2","r3","r4"],"riesgo":"alto|medio|bajo","potencial":"alto|medio|bajo","mes_pico":numero}`;

  try {
    setLoading(true,`Usando ${model}...`);
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({
        model,
        messages:[
          {role:'system',content:'Analista experto en productos digitales. Respondes SIEMPRE con JSON puro válido, sin texto adicional.'},
          {role:'user',content:prompt}
        ],
        temperature:.6, max_tokens:2048,
        response_format:{type:'json_object'}
      })
    });

    if(!res.ok){
      const eb=await res.json().catch(()=>({}));
      throw new Error(`${eb?.error?.code||res.status}::${eb?.error?.message||res.statusText}`);
    }
    const data=await res.json();
    const raw=data.choices?.[0]?.message?.content||'';
    let parsed;
    try{ parsed=JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()); }
    catch(e){ throw new Error('Formato inesperado. Intenta de nuevo.'); }
    renderResults(parsed,d.horizon,true,model);

  } catch(err){
    let msg=err.message||'Error desconocido.';
    if(msg.includes('401')||msg.includes('invalid_api_key'))
      msg='API Key inválida. Obtén una nueva en <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>';
    else if(msg.includes('429')||msg.includes('rate_limit'))
      msg='Límite alcanzado. Espera unos segundos o prueba con Llama 3 8B (más rápido).';
    else if(msg.includes('model_not_found'))
      msg='Modelo no disponible. Selecciona otro modelo.';
    else if(msg.includes('Failed to fetch')||msg.includes('NetworkError'))
      msg='Error de red. Verifica tu conexión a internet.';
    showErr(msg);
    $('ai-resp').textContent='⚠ Error. Revisa el mensaje arriba.';
  } finally { setLoading(false); }
}

//DEMO
//en caso de no conectar a la IA la demo funciona como un ejemplo de lo que deberia mostrar al hacerce la peticion
function runDemo(){
  const d=collectInputs();
  const {price,marketing,competition,audsize,experience,launchPow,horizon,category,title}=d;
  const score=Math.min(10,
    (audsize*1.8)+(experience*1.2)+(launchPow*1.5)+
    (marketing>0?Math.log10(marketing+1)*1.2:0)+
    (competition===1?2:competition===2?1:0)+
    (price<15?1.5:price<30?.5:0)
  );
  const base=Math.round(5+score*12+(marketing/50));
  const ventas=Array.from({length:horizon},(_,i)=>{
    const ramp=i===0?1.6:i===1?1.3:i===2?1.1:1;
    return Math.max(1,Math.round(base*ramp*(1+(score/100)*i)*(0.85+Math.random()*.3)));
  });
  const ingresos=ventas.map(v=>parseFloat((v*price*.7).toFixed(2)));
  const totalV=ventas.reduce((a,b)=>a+b,0);
  const totalI=ingresos.reduce((a,b)=>a+b,0);
  const mkt=marketing*horizon;
  const roi=mkt>0?((totalI-mkt)/mkt*100):150;
  const mesPico=ventas.indexOf(Math.max(...ventas))+1;
  const riesgo=score<3?'alto':score<6?'medio':'bajo';
  const potencial=score<3?'bajo':score<6?'medio':'alto';
  const analisis=`El modelo estadístico proyecta un potencial ${potencial.toUpperCase()} con riesgo ${riesgo.toUpperCase()} para "${title}" en la categoría ${category}. El puntaje de viabilidad es ${score.toFixed(1)}/10.\n\nEl pico de ventas se espera en el Mes ${mesPico}. Tu audiencia (${['ninguna','pequeña','media','grande'][audsize]}) y experiencia (${['ninguna','poca','moderada','alta'][experience]}) son factores clave en esta proyección.\n\nCon $${price} y $${marketing}/mes en marketing, se proyectan ${totalV} ventas y $${totalI.toFixed(0)} USD en ${horizon} meses (ROI estimado: ${roi.toFixed(0)}%).`;
  renderResults({ventas_mes:ventas,ingresos_mes:ingresos,total_ventas:totalV,total_ingresos:totalI,
    conversion_rate:parseFloat((score*.4+1).toFixed(1)),roi,analisis,
    recomendaciones:[
      'Construye una lista de email antes del lanzamiento — puede triplicar ventas iniciales',
      'Lanza con descuento del 30% por tiempo limitado para aceleración inicial',
      'Publica contenido gratuito relacionado para validar el interés del mercado',
      'Considera un bundle con otro recurso para aumentar el ticket promedio',
    ],riesgo,potencial,mes_pico:mesPico},horizon,false,null);
}

// RENDERIZADO
//se envian los datos de la IA al HTML para renderizarlos en pantalla
function renderResults(r,horizon,isAI,modelUsed){
  $('results-card').style.display='block';
  const ml=$('mode-label');
  if(isAI){
    const sn=modelUsed?modelUsed.split('-').slice(0,3).join(' '):'GROQ';
    ml.className='mode-label mode-ai';
    ml.textContent=`⚡ GROQ — ${sn.toUpperCase()}`;
  } else {
    ml.className='mode-label mode-demo';
    ml.textContent='📊';
  }
  $('demo-banner').style.display=isAI?'none':'block';

  const rt=r.riesgo==='bajo'?'th':r.riesgo==='medio'?'tm':'tl';
  const pt=r.potencial==='alto'?'th':r.potencial==='medio'?'tm':'tl';

  $('metrics').style.display='grid';
  $('metrics').innerHTML=`
    <div class="metric"><div class="mval">${(r.total_ventas||0).toLocaleString()}</div><div class="mlbl">Ventas Totales</div></div>
    <div class="metric"><div class="mval">$${Math.round(r.total_ingresos||0).toLocaleString()}</div><div class="mlbl">Ingresos USD</div></div>
    <div class="metric"><div class="mval">${(r.conversion_rate||0).toFixed(1)}%</div><div class="mlbl">Conversión Est.</div></div>
    <div class="metric"><div class="mval">${Math.round(r.roi||0)}%</div><div class="mlbl">ROI Estimado</div></div>
  `;

  $('chart-wrap').style.display='block';
  const labels=Array.from({length:horizon},(_,i)=>`Mes ${i+1}`);
  const ventas=(r.ventas_mes||[]).slice(0,horizon);
  const ingresos=(r.ingresos_mes||[]).slice(0,horizon);
  if(chartInst) chartInst.destroy();
  chartInst=new Chart($('chart').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'Ventas (uds)',data:ventas,
       backgroundColor:'rgba(14, 131, 146, 0.31)',borderColor:'#2162c4',
       borderWidth:2,borderRadius:3,yAxisID:'y'},
      {label:'Ingresos (USD)',data:ingresos,type:'line',borderColor:'#fb983c',
       backgroundColor:'rgba(191, 117, 241, 0.24)',borderWidth:2.5,pointBackgroundColor:'#fbee3c',
       pointRadius:4,tension:.4,fill:true,yAxisID:'y2'}
    ]},
    options:{
      responsive:true,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{color:'#6b6b88',font:{family:'DM Mono',size:11}}}},
      scales:{
        x:{ticks:{color:'#6b6b88',font:{family:'DM Mono',size:11}},grid:{color:'#1e1e2e'}},
        y:{ticks:{color:'#00ff88',font:{family:'DM Mono',size:11}},grid:{color:'#1e1e2e'}},
        y2:{position:'right',ticks:{color:'#fb923c',font:{family:'DM Mono',size:11},
          callback:v=>'$'+v.toLocaleString()},grid:{display:false}}
      }}
  });

  const recoms=(r.recomendaciones||[]).map((rc,i)=>`  ${i+1}. ${rc}`).join('\n');
  $('ai-resp').innerHTML=`
<div style="color:#fb923c;font-weight:600;margin-bottom:11px">▶ ANÁLISIS PREDICTIVO ${isAI?'— GROQ AI':'— MODELO ESTADÍSTICO'}</div>
<div style="color:#fb923c;font-size:.69rem;letter-spacing:1px;margin-bottom:13px;opacity:.8">
  RIESGO: <span class="tag ${rt}">${(r.riesgo||'').toUpperCase()}</span>
  POTENCIAL: <span class="tag ${pt}">${(r.potencial||'').toUpperCase()}</span>
  MES PICO: <span style="color:rgb(230, 171, 9)">Mes ${r.mes_pico||'-'}</span>
</div>
<div style="margin-bottom:17px;line-height:2">${(r.analisis||'').replace(/\n/g,'<br/>')}</div>
<div id="recomendations" style="color:#fb923c;font-size:.69rem;letter-spacing:1px;margin-bottom:9px">▶ RECOMENDACIONES ESTRATÉGICAS</div>
<div style="line-height:2.2;color:#4141ee">${recoms}</div>`;

  $('results-card').scrollIntoView({behavior:'smooth',block:'start'});
}

// EVENTOS
//eventos de los botones MODO DEMO y PREDECIR CON GROQ AI
$('btn-ai').addEventListener('click', runGroq);
$('btn-demo').addEventListener('click',()=>{
  setLoading(true,'Calculando predicción...');
  setTimeout(()=>{ setLoading(false); runDemo(); },500);
});