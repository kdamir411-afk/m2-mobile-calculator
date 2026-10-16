(()=>{'use strict';
if(!localStorage.getItem('m2_admin_token'))return;

const DATA_KEY='m2_rnp_v1';
const GOALS_KEY='m2_rnp_goals_v1';
const LAST_CALC_KEY='m2_rnp_last_calc_id_v1';
const metricDefs=[
  ['newCalls','Новые звонки'],
  ['productiveCalls','Результативные звонки'],
  ['chats','Переписки'],
  ['meetingsSet','Назначено встреч'],
  ['meetingsDone','Проведено встреч'],
  ['calculations','Расчёты'],
  ['payments','Оплаты']
];
const emptyDay=()=>({newCalls:0,productiveCalls:0,chats:0,meetingsSet:0,meetingsDone:0,calculations:0,payments:0,sales:0});
const emptyGoals=()=>({newCalls:0,productiveCalls:0,chats:0,meetingsSet:0,meetingsDone:0,calculations:0,payments:0,dailySales:0,monthlySales:0});
let view='today';
let data=load(DATA_KEY,{});if(!data||typeof data!=='object'||Array.isArray(data))data={};
let goals={...emptyGoals(),...load(GOALS_KEY,{})};

function load(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
function save(){localStorage.setItem(DATA_KEY,JSON.stringify(data))}
function saveGoals(){localStorage.setItem(GOALS_KEY,JSON.stringify(goals))}
function safe(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:0}
function clampCount(v){return Math.max(0,Math.round(Number(v)||0))}
function dateKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function dateFromKey(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)}
function today(){return dateKey(new Date())}
function getDay(k,create=true){if(!data[k]&&create)data[k]=emptyDay();return {...emptyDay(),...(data[k]||{})}}
function setDay(k,v){data[k]={...emptyDay(),...v};save()}
function money(v){return Math.round(Number(v)||0).toLocaleString('ru-RU')}
function pct(a,b){return b>0?Math.round((a/b)*100):null}
function pctText(a,b){const p=pct(a,b);return p===null?'—':p+'%'}
function fmtDate(k){return dateFromKey(k).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})}
function sumRows(keys){const out=emptyDay();for(const k of keys){const x=getDay(k,false);for(const [id] of metricDefs)out[id]+=clampCount(x[id]);out.sales+=safe(x.sales)}return out}
function rangeKeys(start,end){const keys=[];const d=new Date(start);d.setHours(12,0,0,0);const e=new Date(end);e.setHours(12,0,0,0);while(d<=e){keys.push(dateKey(d));d.setDate(d.getDate()+1)}return keys}
function weekRange(){const now=new Date(),start=new Date(now);start.setDate(now.getDate()-((now.getDay()+6)%7));start.setHours(0,0,0,0);const end=new Date(start);end.setDate(start.getDate()+6);end.setHours(23,59,59,999);return [start,end]}
function monthRange(){const now=new Date();return [new Date(now.getFullYear(),now.getMonth(),1),new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999)]}
function currentKeys(){if(view==='today')return[today()];if(view==='week'){const [s,e]=weekRange();return rangeKeys(s,e)}const [s,e]=monthRange();return rangeKeys(s,e)}
function remainingWeekdaysThisMonth(){const now=new Date(),end=new Date(now.getFullYear(),now.getMonth()+1,0);let n=0,d=new Date(now.getFullYear(),now.getMonth(),now.getDate());while(d<=end){const wd=d.getDay();if(wd!==0&&wd!==6)n++;d.setDate(d.getDate()+1)}return n}
function weakest(t){const steps=[
  ['productiveCalls','newCalls','звонок → результативный'],
  ['meetingsSet','productiveCalls','результативный → встреча'],
  ['meetingsDone','meetingsSet','назначена → проведена'],
  ['calculations','meetingsDone','встреча → расчёт'],
  ['payments','calculations','расчёт → оплата']
];let best=null;for(const [a,b,label] of steps){if(t[b]<=0)continue;const rate=(t[a]/t[b])*100;if(!best||rate<best.rate)best={label,rate}}return best}
function periodLabel(){if(view==='today')return 'Сегодня';if(view==='week')return 'Неделя';return 'Месяц'}

function inject(){
  if(document.getElementById('rnpScreen'))return;
  const style=document.createElement('style');style.textContent=`
    .navinner{grid-template-columns:repeat(5,1fr)!important}
    .rnpseg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px;margin-bottom:14px}
    .rnpseg button{background:transparent;color:var(--muted);min-height:40px;padding:8px 4px}.rnpseg button.active{background:#fff;color:#111}
    .rnprow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--border)}.rnprow:last-child{border-bottom:0}
    .rnpname{font-weight:650}.rnpgoal{font-size:11px;color:var(--muted);margin-top:3px}.rnpcounter{display:grid;grid-template-columns:38px 48px 38px;align-items:center;gap:5px}.rnpcounter button{min-height:38px;padding:0}.rnpvalue{text-align:center;font-size:18px;font-weight:750}
    .rnpstats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rnpstat{background:var(--card2);border-radius:13px;padding:11px}.rnpstat span{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}.rnpstat b{font-size:17px}
    .rnpfunnel{display:flex;align-items:center;gap:5px;overflow:auto;padding:4px 0 2px}.rnpstep{flex:0 0 auto;background:var(--card2);border-radius:12px;padding:9px 10px;text-align:center;min-width:88px}.rnpstep b{display:block;font-size:17px}.rnpstep span{display:block;color:var(--muted);font-size:10px;margin-top:2px}.rnparrow{color:var(--muted);font-size:12px;white-space:nowrap}
    .rnpprogress{height:8px;background:var(--card2);border-radius:999px;overflow:hidden;margin-top:10px}.rnpprogress i{display:block;height:100%;background:var(--good);border-radius:999px}
    .rnppay{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.rnppay button{min-height:48px}.rnpsalesinput{font-weight:750;font-size:18px}
    .rnpgoals{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rnpgoals label{margin-top:0}.rnpgoals input{min-height:44px;font-size:14px}
    .rnphistoryrow{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--border)}.rnphistoryrow:last-child{border-bottom:0}.rnphistorymeta{font-size:11px;color:var(--muted);margin-top:3px}.rnpwarn{color:#ffcc7a}.rnpgood{color:var(--good)}
    @media(max-width:390px){.navbtn{font-size:10px}.rnpgoals{grid-template-columns:1fr}.rnpcounter{grid-template-columns:36px 42px 36px}}
  `;document.head.appendChild(style);

  const screen=document.createElement('section');screen.id='rnpScreen';screen.className='screen';
  const access=document.getElementById('accessScreen');const main=document.querySelector('main');if(access)main.insertBefore(screen,access);else main.appendChild(screen);

  const nav=document.querySelector('.navinner');const accessBtn=nav?.querySelector('[data-tab="access"]');if(nav&&!nav.querySelector('[data-tab="rnp"]')){
    const b=document.createElement('button');b.className='navbtn';b.dataset.tab='rnp';b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="M3 7l5-4 5 5 7-6"/></svg><span>РНП</span>';
    if(accessBtn)nav.insertBefore(b,accessBtn);else nav.appendChild(b);
  }
  bindNav();render();bindAutoCalc();
}

function bindNav(){
  const rnpBtn=document.querySelector('[data-tab="rnp"]');if(rnpBtn)rnpBtn.addEventListener('click',()=>setTimeout(showRnp,0));
  document.querySelectorAll('.navbtn:not([data-tab="rnp"])').forEach(b=>b.addEventListener('click',()=>{const s=document.getElementById('rnpScreen');if(s)s.classList.remove('active')}));
}
function showRnp(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('rnpScreen')?.classList.add('active');document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab==='rnp'));render();window.scrollTo(0,0)}

function render(){
  const box=document.getElementById('rnpScreen');if(!box)return;
  const keys=currentKeys(),t=sumRows(keys),day=getDay(today());
  const weak=weakest(t),salesGoal=view==='today'?safe(goals.dailySales):(view==='month'?safe(goals.monthlySales):0),progress=salesGoal?Math.min(100,Math.round(t.sales/salesGoal*100)):0;
  const history=Object.keys(data).filter(k=>data[k]&&Object.values(getDay(k,false)).some(v=>Number(v)>0)).sort((a,b)=>b.localeCompare(a)).slice(0,14);
  box.innerHTML=`
    <h1>РНП</h1><div class="sub">Личный ежедневный контроль активности и продаж.</div>
    <div class="rnpseg"><button data-rnp-view="today" class="${view==='today'?'active':''}">Сегодня</button><button data-rnp-view="week" class="${view==='week'?'active':''}">Неделя</button><button data-rnp-view="month" class="${view==='month'?'active':''}">Месяц</button></div>
    ${view==='today'?todayEditor(day):summaryHtml(t,weak,salesGoal,progress)}
    ${view==='today'?funnelCard(t,weak):''}
    ${view==='today'?goalsCard():''}
    <div class="card"><div class="head"><b>Последние дни</b><span class="count">${history.length?history.length+' дн.':''}</span></div><div>${history.length?history.map(historyRow).join(''):'<div class="small" style="padding:14px 0">РНП пока пустой.</div>'}</div></div>
  `;
  bindScreen();
}

function todayEditor(d){
  const salesGoal=safe(goals.dailySales),salesProgress=salesGoal?Math.min(100,Math.round(safe(d.sales)/salesGoal*100)):0;
  return `
    <div class="card"><div class="head"><div><b>${new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</b><div class="small">Изменяется только текущий день.</div></div><span class="count">${salesGoal?salesProgress+'% плана':''}</span></div>
      ${metricDefs.map(([id,label])=>metricRow(id,label,d[id])).join('')}
    </div>
    <div class="card"><div class="settingtitle">Продажи</div><label>Сумма продаж за сегодня, ₸</label><input id="rnpSales" class="rnpsalesinput" type="number" inputmode="numeric" min="0" step="1000" value="${Math.round(safe(d.sales))}">
      ${salesGoal?`<div class="line"><span class="small">План ${money(salesGoal)} ₸</span><b>${salesProgress}%</b></div><div class="rnpprogress"><i style="width:${salesProgress}%"></i></div>`:''}
      <div style="margin-top:14px"><div class="small" style="margin-bottom:6px">Быстро добавить оплату</div><div class="rnppay"><input id="rnpPayAmount" type="number" inputmode="numeric" min="0" step="1000" placeholder="Сумма, ₸"><button id="rnpAddPayment">+ Оплата</button></div></div>
    </div>`;
}
function metricRow(id,label,value){const g=safe(goals[id]);return `<div class="rnprow"><div><div class="rnpname">${label}${id==='calculations'?'<span class="rnpgoal"> · сохранённые считаются автоматически</span>':''}</div><div class="rnpgoal">${g?'Цель: '+money(g):'Цель не задана'}</div></div><div class="rnpcounter"><button class="secondary" data-rnp-adjust="${id}" data-delta="-1">−</button><div class="rnpvalue">${clampCount(value)}</div><button data-rnp-adjust="${id}" data-delta="1">+</button></div></div>`}
function summaryHtml(t,weak,salesGoal,progress){
  let extra='';if(view==='month'&&salesGoal){const remain=Math.max(0,salesGoal-t.sales),days=remainingWeekdaysThisMonth();extra=`<div class="small" style="margin-top:10px">Осталось до плана: <b>${money(remain)} ₸</b>${remain>0&&days?` · нужно в среднем <b>${money(Math.ceil(remain/days))} ₸</b> за оставшийся рабочий день`:''}</div>`}
  return `<div class="card"><div class="head"><div><div class="settingtitle">${periodLabel()}</div><div class="small">Сводка по фактическим данным.</div></div>${salesGoal?`<b>${progress}%</b>`:''}</div><div class="rnpstats" style="margin-top:12px"><div class="rnpstat"><span>Продажи</span><b>${money(t.sales)} ₸</b></div><div class="rnpstat"><span>Оплаты</span><b>${t.payments}</b></div><div class="rnpstat"><span>Расчёты</span><b>${t.calculations}</b></div><div class="rnpstat"><span>Новые звонки</span><b>${t.newCalls}</b></div></div>${salesGoal?`<div class="rnpprogress"><i style="width:${progress}%"></i></div>`:''}${extra}</div>${funnelCard(t,weak)}`;
}
function funnelCard(t,weak){
  const steps=[['newCalls','Новые'],['productiveCalls','Результ.'],['meetingsSet','Встречи'],['meetingsDone','Проведено'],['calculations','Расчёты'],['payments','Оплаты']];
  let funnel='';steps.forEach(([id,label],i)=>{if(i){const prev=steps[i-1][0];funnel+=`<span class="rnparrow">${pctText(t[id],t[prev])} →</span>`}funnel+=`<div class="rnpstep"><b>${t[id]}</b><span>${label}</span></div>`});
  return `<div class="card"><div class="settingtitle">Воронка</div><div class="rnpfunnel">${funnel}</div><div class="small ${weak&&weak.rate<50?'rnpwarn':''}" style="margin-top:10px">${weak?`Главная просадка: <b>${weak.label}</b> — ${Math.round(weak.rate)}%`:'Добавляй действия — здесь появится конверсия и просадка.'}</div></div>`;
}
function goalsCard(){return `<div class="card"><div class="head"><div><div class="settingtitle">Цели</div><div class="small">Нужны только для план/факт. Можно оставить пустыми.</div></div><button id="rnpGoalsToggle" class="secondary">Настроить</button></div><div id="rnpGoalsBox" class="hidden" style="margin-top:13px"><div class="rnpgoals">${metricDefs.map(([id,label])=>`<div><label>${label}</label><input data-rnp-goal="${id}" type="number" inputmode="numeric" min="0" value="${safe(goals[id])||''}"></div>`).join('')}<div><label>Продажи в день, ₸</label><input data-rnp-goal="dailySales" type="number" inputmode="numeric" min="0" value="${safe(goals.dailySales)||''}"></div><div><label>Продажи в месяц, ₸</label><input data-rnp-goal="monthlySales" type="number" inputmode="numeric" min="0" value="${safe(goals.monthlySales)||''}"></div></div></div></div>`}
function historyRow(k){const x=getDay(k,false);return `<div class="rnphistoryrow"><div><b>${fmtDate(k)}</b><div class="rnphistorymeta">${x.newCalls} звонков · ${x.calculations} расч. · ${x.payments} оплат</div></div><b>${money(x.sales)} ₸</b></div>`}

function bindScreen(){
  document.querySelectorAll('[data-rnp-view]').forEach(b=>b.onclick=()=>{view=b.dataset.rnpView;render()});
  document.querySelectorAll('[data-rnp-adjust]').forEach(b=>b.onclick=()=>{const k=today(),d=getDay(k),id=b.dataset.rnpAdjust;d[id]=clampCount(d[id]+Number(b.dataset.delta));setDay(k,d);render()});
  const sales=document.getElementById('rnpSales');if(sales)sales.onchange=()=>{const k=today(),d=getDay(k);d.sales=safe(sales.value);setDay(k,d);render()};
  const add=document.getElementById('rnpAddPayment');if(add)add.onclick=()=>{const input=document.getElementById('rnpPayAmount'),amount=safe(input?.value);if(!amount){input?.focus();return}const k=today(),d=getDay(k);d.payments=clampCount(d.payments+1);d.sales=safe(d.sales)+amount;setDay(k,d);render()};
  const toggle=document.getElementById('rnpGoalsToggle');if(toggle)toggle.onclick=()=>document.getElementById('rnpGoalsBox')?.classList.toggle('hidden');
  document.querySelectorAll('[data-rnp-goal]').forEach(i=>i.onchange=()=>{goals[i.dataset.rnpGoal]=safe(i.value);saveGoals();render()});
}

function bindAutoCalc(){
  const b=document.getElementById('modalSave');if(!b||b.dataset.rnpBound)return;b.dataset.rnpBound='1';
  b.addEventListener('click',()=>setTimeout(trackSavedCalculation,0));
}
function trackSavedCalculation(){
  const history=load('m2_history',[]);if(!Array.isArray(history)||!history.length)return;const x=history[0],id=String(x?.id||'');if(!id||id===localStorage.getItem(LAST_CALC_KEY))return;
  const d0=Number(x.id)?new Date(Number(x.id)):new Date(),k=dateKey(d0),d=getDay(k);d.calculations=clampCount(d.calculations+1);setDay(k,d);localStorage.setItem(LAST_CALC_KEY,id);if(document.getElementById('rnpScreen')?.classList.contains('active'))render();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
