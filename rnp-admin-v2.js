(()=>{'use strict';
if(!localStorage.getItem('m2_admin_token'))return;

const DATA_KEY='m2_rnp_v1';
const GOALS_KEY='m2_rnp_goals_v1';
const LAST_CALC_KEY='m2_rnp_last_calc_id_v1';
const metricDefs=[
  ['newCalls','Новые звонки'],
  ['productiveCalls','Результативные'],
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
function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return dateKey(d)}
function getDay(k,create=true){if(!data[k]&&create)data[k]=emptyDay();return {...emptyDay(),...(data[k]||{})}}
function setDay(k,v){data[k]={...emptyDay(),...v};save()}
function money(v){return Math.round(Number(v)||0).toLocaleString('ru-RU')}
function pct(a,b){return b>0?Math.round((a/b)*100):null}
function pctText(a,b){const p=pct(a,b);return p===null?'—':p+'%'}
function fmtDate(k){return dateFromKey(k).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})}
function fullDate(k=today()){return dateFromKey(k).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}
function sumRows(keys){const out=emptyDay();for(const k of keys){const x=getDay(k,false);for(const [id] of metricDefs)out[id]+=clampCount(x[id]);out.sales+=safe(x.sales)}return out}
function rangeKeys(start,end){const keys=[];const d=new Date(start);d.setHours(12,0,0,0);const e=new Date(end);e.setHours(12,0,0,0);while(d<=e){keys.push(dateKey(d));d.setDate(d.getDate()+1)}return keys}
function weekRange(){const now=new Date(),start=new Date(now);start.setDate(now.getDate()-((now.getDay()+6)%7));start.setHours(0,0,0,0);const end=new Date(start);end.setDate(start.getDate()+6);end.setHours(23,59,59,999);return[start,end]}
function monthRange(){const now=new Date();return[new Date(now.getFullYear(),now.getMonth(),1),new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999)]}
function currentKeys(){if(view==='today')return[today()];if(view==='week'){const[s,e]=weekRange();return rangeKeys(s,e)}const[s,e]=monthRange();return rangeKeys(s,e)}
function remainingWeekdaysThisMonth(){const now=new Date(),end=new Date(now.getFullYear(),now.getMonth()+1,0);let n=0,d=new Date(now.getFullYear(),now.getMonth(),now.getDate());while(d<=end){const wd=d.getDay();if(wd!==0&&wd!==6)n++;d.setDate(d.getDate()+1)}return n}
function activityScore(d){return metricDefs.reduce((sum,[id])=>sum+clampCount(d[id]),0)}
function compareYesterday(cur,prev){const a=activityScore(cur),b=activityScore(prev);if(!a&&!b)return{kind:'none',text:'Пока нет данных для сравнения'};if(!b)return{kind:'up',text:'Вчера активности не было'};const diff=Math.round(((a-b)/b)*100);if(diff===0)return{kind:'same',text:'Как вчера'};return diff>0?{kind:'up',text:`Лучше вчера на ${diff}%`}:{kind:'down',text:`Хуже вчера на ${Math.abs(diff)}%`}}
function goalProgress(d){const values=[];for(const[id]of metricDefs){const g=safe(goals[id]);if(g)values.push(Math.min(100,(clampCount(d[id])/g)*100))}const salesGoal=safe(goals.dailySales);if(salesGoal)values.push(Math.min(100,(safe(d.sales)/salesGoal)*100));if(!values.length)return null;return Math.round(values.reduce((a,b)=>a+b,0)/values.length)}
function weakest(t){const steps=[
  ['productiveCalls','newCalls','звонок → результативный'],
  ['meetingsSet','productiveCalls','результативный → назначена'],
  ['meetingsDone','meetingsSet','назначена → проведена'],
  ['calculations','meetingsDone','проведена → расчёт'],
  ['payments','calculations','расчёт → оплата']
];let best=null;for(const[a,b,label]of steps){if(t[b]<=0)continue;const rate=(t[a]/t[b])*100;if(!best||rate<best.rate)best={label,rate}}return best}
function periodLabel(){if(view==='today')return'Сегодня';if(view==='week')return'Неделя';return'Месяц'}
function reportText(d,k=today()){return[`РНП — ${dateFromKey(k).toLocaleDateString('ru-RU')}`,'',`Новые звонки: ${clampCount(d.newCalls)}`,`Результативные звонки: ${clampCount(d.productiveCalls)}`,`Переписки: ${clampCount(d.chats)}`,`Назначено встреч: ${clampCount(d.meetingsSet)}`,`Проведено встреч: ${clampCount(d.meetingsDone)}`,`Расчёты: ${clampCount(d.calculations)}`,`Оплаты: ${clampCount(d.payments)}`,`Сумма продаж: ${money(d.sales)} ₸`].join('\n')}
async function copyText(text,button){try{await navigator.clipboard.writeText(text)}catch{const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.focus();a.select();document.execCommand('copy');a.remove()}if(button){const old=button.textContent;button.textContent='Скопировано';setTimeout(()=>{if(document.body.contains(button))button.textContent=old},1200)}}

function inject(){
  if(document.getElementById('rnpScreen'))return;
  const style=document.createElement('style');style.textContent=`
    .navinner{grid-template-columns:repeat(5,1fr)!important}
    .rnpseg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:var(--card2);border:1px solid var(--border);border-radius:14px;padding:4px;margin-bottom:12px}
    .rnpseg button{background:transparent;color:var(--muted);min-height:40px;padding:8px 4px}.rnpseg button.active{background:#fff;color:#111}
    .rnphead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}.rnphead h1{margin-bottom:3px}.rnpdate{color:var(--muted);font-size:13px;text-transform:capitalize}.rnpcopy{min-height:38px;padding:8px 11px}
    .rnpstatus{background:var(--card);border:1px solid var(--border);border-radius:17px;padding:12px 14px;margin-bottom:12px}.rnpcompare{font-weight:750}.rnpcompare.up{color:var(--good)}.rnpcompare.down{color:#ff8c8c}.rnpcompare.same,.rnpcompare.none{color:var(--muted)}
    .rnpprogressline{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;font-size:12px;color:var(--muted)}.rnpprogress{height:7px;background:var(--card2);border-radius:999px;overflow:hidden;margin-top:7px}.rnpprogress i{display:block;height:100%;background:var(--good);border-radius:999px}
    .rnplist{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:5px 14px;margin-bottom:12px}.rnprow{display:grid;grid-template-columns:minmax(0,1fr) auto 44px;gap:9px;align-items:center;min-height:56px;border-bottom:1px solid var(--border)}.rnprow:last-child{border-bottom:0}.rnpname{font-weight:650}.rnpvaluebtn{background:transparent!important;color:var(--text)!important;padding:6px 4px!important;min-height:38px!important;font-size:19px!important}.rnpplus{width:44px;min-width:44px;padding:0;font-size:20px}
    .rnpsales{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px;margin-bottom:12px}.rnpsalesline{display:flex;align-items:center;justify-content:space-between;gap:10px}.rnpsalesamount{font-size:28px;font-weight:800;cursor:pointer}.rnpsalesmeta{color:var(--muted);font-size:12px;margin-top:3px}.rnppaybtn{white-space:nowrap}
    .rnpfunnelcompact{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:13px 10px;margin-bottom:12px}.rnpfunnelgrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;margin-top:8px}.rnpfunnelstep{text-align:center;background:var(--card2);border-radius:11px;padding:8px 2px;min-width:0}.rnpfunnelstep b{display:block;font-size:17px}.rnpfunnelstep span{display:block;color:var(--muted);font-size:9px;line-height:1.1;margin-top:3px;white-space:normal}.rnpdrop{margin-top:9px;font-size:12px;color:#ffcc7a}
    .rnpstats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rnpstat{background:var(--card2);border-radius:13px;padding:11px}.rnpstat span{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}.rnpstat b{font-size:17px}
    .rnphistory{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px;margin-bottom:14px}.rnphistoryrow{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer}.rnphistoryrow:last-child{border-bottom:0}.rnphistoryrow:active{opacity:.7}.rnphistorymeta{font-size:11px;color:var(--muted);margin-top:3px}
    .rnpgoalsgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rnpgoalsgrid label{margin-top:0}.rnpgoalsgrid input{min-height:44px;font-size:14px}.rnp-settings-card{margin-top:14px}
    .rnpdaygrid{display:grid;grid-template-columns:1fr auto;gap:9px 14px;margin-top:12px}.rnpdaygrid span{color:var(--muted)}.rnpdaygrid b{text-align:right}
    @media(max-width:390px){.navbtn{font-size:10px}.rnpgoalsgrid{grid-template-columns:1fr}.rnprow{grid-template-columns:minmax(0,1fr) 42px 42px}.rnpfunnelstep b{font-size:16px}.rnpfunnelstep span{font-size:8px}.rnpsalesamount{font-size:25px}}
  `;document.head.appendChild(style);

  const screen=document.createElement('section');screen.id='rnpScreen';screen.className='screen';
  const access=document.getElementById('accessScreen');const main=document.querySelector('main');if(access)main.insertBefore(screen,access);else main.appendChild(screen);
  injectDayModal();
  injectSettingsGoals();

  const nav=document.querySelector('.navinner');const accessBtn=nav?.querySelector('[data-tab="access"]');if(nav&&!nav.querySelector('[data-tab="rnp"]')){
    const b=document.createElement('button');b.className='navbtn';b.dataset.tab='rnp';b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="M3 7l5-4 5 5 7-6"/></svg><span>РНП</span>';
    if(accessBtn)nav.insertBefore(b,accessBtn);else nav.appendChild(b)
  }
  bindNav();render();bindAutoCalc();
}
function injectDayModal(){if(document.getElementById('rnpDayModal'))return;const d=document.createElement('div');d.id='rnpDayModal';d.className='modal hidden';d.innerHTML='<div class="modalbox"><div class="head"><div><div id="rnpDayTitle" class="settingtitle"></div><div id="rnpDaySub" class="small"></div></div><button id="rnpDayClose" class="secondary">Закрыть</button></div><div id="rnpDayContent"></div><div class="actions"><button id="rnpDayCopy" class="secondary">Скопировать</button></div></div>';document.body.appendChild(d);document.getElementById('rnpDayClose').onclick=closeDayModal;d.onclick=e=>{if(e.target===d)closeDayModal()}}
function injectSettingsGoals(){const settings=document.getElementById('settingsScreen');if(!settings||document.getElementById('rnpSettingsCard'))return;const card=document.createElement('div');card.id='rnpSettingsCard';card.className='card rnp-settings-card';card.innerHTML='<div class="head"><div><div class="settingtitle">РНП</div><div class="small">Личные цели для план/факт.</div></div><button id="rnpSettingsToggle" class="secondary">Настроить цели</button></div><div id="rnpSettingsGoals" class="hidden" style="margin-top:13px"></div>';const footer=settings.querySelector('.footer');if(footer)settings.insertBefore(card,footer);else settings.appendChild(card);document.getElementById('rnpSettingsToggle').onclick=()=>{const box=document.getElementById('rnpSettingsGoals');box.classList.toggle('hidden');if(!box.classList.contains('hidden'))renderSettingsGoals()}}
function renderSettingsGoals(){const box=document.getElementById('rnpSettingsGoals');if(!box)return;box.innerHTML=`<div class="rnpgoalsgrid">${metricDefs.map(([id,label])=>`<div><label>${label}</label><input data-rnp-goal="${id}" type="number" inputmode="numeric" min="0" value="${safe(goals[id])||''}" placeholder="0"></div>`).join('')}<div><label>Продажи в день, ₸</label><input data-rnp-goal="dailySales" type="number" inputmode="numeric" min="0" value="${safe(goals.dailySales)||''}" placeholder="0"></div><div><label>Продажи в месяц, ₸</label><input data-rnp-goal="monthlySales" type="number" inputmode="numeric" min="0" value="${safe(goals.monthlySales)||''}" placeholder="0"></div></div>`;box.querySelectorAll('[data-rnp-goal]').forEach(i=>i.onchange=()=>{goals[i.dataset.rnpGoal]=safe(i.value);saveGoals();if(document.getElementById('rnpScreen')?.classList.contains('active'))render()})}

function bindNav(){const rnpBtn=document.querySelector('[data-tab="rnp"]');if(rnpBtn)rnpBtn.addEventListener('click',()=>setTimeout(showRnp,0));document.querySelectorAll('.navbtn:not([data-tab="rnp"])').forEach(b=>b.addEventListener('click',()=>{document.getElementById('rnpScreen')?.classList.remove('active')}))}
function showRnp(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('rnpScreen')?.classList.add('active');document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab==='rnp'));render();window.scrollTo(0,0)}

function render(){const box=document.getElementById('rnpScreen');if(!box)return;const keys=currentKeys(),t=sumRows(keys),day=getDay(today()),history=Object.keys(data).filter(k=>data[k]&&Object.values(getDay(k,false)).some(v=>Number(v)>0)).sort((a,b)=>b.localeCompare(a)).slice(0,14);box.innerHTML=view==='today'?renderToday(day,history):renderPeriod(t,history);bindScreen()}
function renderToday(day,history){const cmp=compareYesterday(day,getDay(yesterday(),false)),gp=goalProgress(day),weak=weakest(day);return`
  <div class="rnphead"><div><h1>РНП</h1><div class="rnpdate">${fullDate()}</div></div><button id="rnpCopy" class="secondary rnpcopy">Скопировать</button></div>
  <div class="rnpseg"><button data-rnp-view="today" class="active">Сегодня</button><button data-rnp-view="week">Неделя</button><button data-rnp-view="month">Месяц</button></div>
  <div class="rnpstatus"><div class="rnpcompare ${cmp.kind}">${cmp.kind==='up'?'↑ ':cmp.kind==='down'?'↓ ':cmp.kind==='same'?'= ':''}${cmp.text}</div>${gp===null?'':`<div class="rnpprogressline"><span>Выполнение целей</span><b>${gp}%</b></div><div class="rnpprogress"><i style="width:${gp}%"></i></div>`}</div>
  <div class="rnplist">${metricDefs.map(([id,label])=>compactRow(id,label,day[id])).join('')}</div>
  ${salesCard(day)}
  ${funnelCard(day,weak)}
  ${historyCard(history)}
`}
function compactRow(id,label,value){return`<div class="rnprow"><div class="rnpname">${label}</div><button class="rnpvaluebtn" data-rnp-edit="${id}" aria-label="Изменить ${label}">${clampCount(value)}</button><button class="rnpplus" data-rnp-plus="${id}" aria-label="Добавить ${label}">+</button></div>`}
function salesCard(d){return`<div class="rnpsales"><div class="rnpsalesline"><div><div class="small">Продажи</div><div id="rnpSalesAmount" class="rnpsalesamount">${money(d.sales)} ₸</div><div class="rnpsalesmeta">${clampCount(d.payments)} оплат${clampCount(d.payments)===1?'а':''}</div></div><button id="rnpAddPayment" class="rnppaybtn">+ Оплата</button></div></div>`}
function funnelCard(t,weak){const steps=[['newCalls','Новые'],['productiveCalls','Результ.'],['meetingsSet','Назнач.'],['meetingsDone','Провед.'],['calculations','Расчёт'],['payments','Оплата']];return`<div class="rnpfunnelcompact"><div class="settingtitle">Воронка</div><div class="rnpfunnelgrid">${steps.map(([id,label])=>`<div class="rnpfunnelstep"><b>${clampCount(t[id])}</b><span>${label}</span></div>`).join('')}</div><div class="rnpdrop">${weak?`↓ Просадка: <b>${weak.label}</b> · ${Math.round(weak.rate)}%`:'Добавляй действия — здесь появится просадка.'}</div></div>`}
function historyCard(history){return`<div class="rnphistory"><div class="head"><b>Последние дни</b><span class="count">${history.length?history.length+' дн.':''}</span></div><div>${history.length?history.map(historyRow).join(''):'<div class="small" style="padding:14px 0">РНП пока пустой.</div>'}</div></div>`}
function historyRow(k){const x=getDay(k,false);return`<div class="rnphistoryrow" data-rnp-day="${k}"><div><b>${fmtDate(k)}</b><div class="rnphistorymeta">${x.newCalls} звонков · ${x.calculations} расч. · ${x.payments} оплат</div></div><b>${money(x.sales)} ₸</b></div>`}
function renderPeriod(t,history){const weak=weakest(t),salesGoal=view==='month'?safe(goals.monthlySales):0,progress=salesGoal?Math.min(100,Math.round(t.sales/salesGoal*100)):0;let extra='';if(view==='month'&&salesGoal){const remain=Math.max(0,salesGoal-t.sales),days=remainingWeekdaysThisMonth();extra=`<div class="small" style="margin-top:10px">Осталось до плана: <b>${money(remain)} ₸</b>${remain>0&&days?` · нужно в среднем <b>${money(Math.ceil(remain/days))} ₸</b> за оставшийся рабочий день`:''}</div>`}return`
  <div class="rnphead"><div><h1>РНП</h1><div class="rnpdate">${periodLabel()}</div></div></div>
  <div class="rnpseg"><button data-rnp-view="today">Сегодня</button><button data-rnp-view="week" class="${view==='week'?'active':''}">Неделя</button><button data-rnp-view="month" class="${view==='month'?'active':''}">Месяц</button></div>
  <div class="card"><div class="head"><div><div class="settingtitle">${periodLabel()}</div><div class="small">Сводка по фактическим данным.</div></div>${salesGoal?`<b>${progress}%</b>`:''}</div><div class="rnpstats" style="margin-top:12px"><div class="rnpstat"><span>Продажи</span><b>${money(t.sales)} ₸</b></div><div class="rnpstat"><span>Оплаты</span><b>${t.payments}</b></div><div class="rnpstat"><span>Расчёты</span><b>${t.calculations}</b></div><div class="rnpstat"><span>Новые звонки</span><b>${t.newCalls}</b></div></div>${salesGoal?`<div class="rnpprogress"><i style="width:${progress}%"></i></div>`:''}${extra}</div>
  ${funnelCard(t,weak)}
  ${historyCard(history)}
`}

function bindScreen(){
  document.querySelectorAll('[data-rnp-view]').forEach(b=>b.onclick=()=>{view=b.dataset.rnpView;render()});
  document.querySelectorAll('[data-rnp-plus]').forEach(b=>b.onclick=()=>{const d=getDay(today()),id=b.dataset.rnpPlus;d[id]=clampCount(d[id]+1);setDay(today(),d);try{navigator.vibrate?.(10)}catch{}render()});
  document.querySelectorAll('[data-rnp-edit]').forEach(b=>b.onclick=()=>editMetric(b.dataset.rnpEdit));
  document.querySelectorAll('[data-rnp-day]').forEach(r=>r.onclick=()=>openDayModal(r.dataset.rnpDay));
  const copy=document.getElementById('rnpCopy');if(copy)copy.onclick=()=>copyText(reportText(getDay(today())),copy);
  const sales=document.getElementById('rnpSalesAmount');if(sales)sales.onclick=editSales;
  const add=document.getElementById('rnpAddPayment');if(add)add.onclick=addPayment;
}
function editMetric(id){const d=getDay(today()),label=metricDefs.find(x=>x[0]===id)?.[1]||'Значение',v=prompt(label,String(clampCount(d[id])));if(v===null)return;const n=Number(v);if(!Number.isFinite(n)||n<0)return;d[id]=clampCount(n);setDay(today(),d);render()}
function editSales(){const d=getDay(today()),v=prompt('Сумма продаж, ₸',String(Math.round(safe(d.sales))));if(v===null)return;const n=Number(String(v).replace(/\s/g,''));if(!Number.isFinite(n)||n<0)return;d.sales=n;setDay(today(),d);render()}
function addPayment(){const v=prompt('Сумма оплаты, ₸','');if(v===null)return;const amount=Number(String(v).replace(/\s/g,''));if(!Number.isFinite(amount)||amount<=0)return;const d=getDay(today());d.payments=clampCount(d.payments+1);d.sales=safe(d.sales)+amount;setDay(today(),d);try{navigator.vibrate?.(15)}catch{}render()}
function openDayModal(k){const d=getDay(k,false),modal=document.getElementById('rnpDayModal');document.getElementById('rnpDayTitle').textContent=fullDate(k);document.getElementById('rnpDaySub').textContent='РНП за день';document.getElementById('rnpDayContent').innerHTML=`<div class="rnpdaygrid">${metricDefs.map(([id,label])=>`<span>${label}</span><b>${clampCount(d[id])}</b>`).join('')}<span>Сумма продаж</span><b>${money(d.sales)} ₸</b></div>`;const c=document.getElementById('rnpDayCopy');c.onclick=()=>copyText(reportText(d,k),c);modal.classList.remove('hidden')}
function closeDayModal(){document.getElementById('rnpDayModal')?.classList.add('hidden')}

function bindAutoCalc(){const b=document.getElementById('modalSave');if(!b||b.dataset.rnpBound)return;b.dataset.rnpBound='1';b.addEventListener('click',()=>setTimeout(trackSavedCalculation,0))}
function trackSavedCalculation(){const history=load('m2_history',[]);if(!Array.isArray(history)||!history.length)return;const x=history[0],id=String(x?.id||'');if(!id||id===localStorage.getItem(LAST_CALC_KEY))return;const d0=Number(x.id)?new Date(Number(x.id)):new Date(),k=dateKey(d0),d=getDay(k);d.calculations=clampCount(d.calculations+1);setDay(k,d);localStorage.setItem(LAST_CALC_KEY,id);if(document.getElementById('rnpScreen')?.classList.contains('active'))render()}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
