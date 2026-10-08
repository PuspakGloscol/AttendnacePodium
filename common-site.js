const SUPABASE_URL=window.SUPABASE_CONFIG?.url||'';
const SUPABASE_KEY=window.SUPABASE_CONFIG?.key||'';
const DEPARTMENT_SLUG=window.SUPABASE_CONFIG?.departmentSlug||'';
const supabaseReady=Boolean(SUPABASE_URL&&SUPABASE_KEY&&!SUPABASE_URL.includes('YOUR_')&&!SUPABASE_KEY.includes('YOUR_'));
const client=supabaseReady?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
const demo=[
  {id:'demo1',group_name:'Games Development A',recent_attendance:96.4,attendance:97.2,punctuality:95.8},
  {id:'demo2',group_name:'Games Development B',recent_attendance:94.7,attendance:95.1,punctuality:94.2},
  {id:'demo3',group_name:'Games Design',recent_attendance:93.1,attendance:93.8,punctuality:94.1},
  {id:'demo4',group_name:'Interactive Media',recent_attendance:91.8,attendance:92.4,punctuality:91.7},
  {id:'demo5',group_name:'Creative Games',recent_attendance:89.7,attendance:89.9,punctuality:90.5}
];
function score(g){return (Number(g.recent_attendance)+Number(g.punctuality))/2;}
function sortedGroups(rows){return [...rows].sort((a,b)=>score(b)-score(a)||Number(b.recent_attendance)-Number(a.recent_attendance)||String(a.group_name).localeCompare(String(b.group_name)));}
function pct(v){return `${Number(v||0).toFixed(1)}%`;}
function feedback(g){const s=score(g);return s>=95?'Outstanding':s>=90?'Excellent':'Needs Improvement';}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
async function getGroups(){
  if(!client)return sortedGroups(JSON.parse(JSON.stringify(demo)));
  const {data:d,error:de}=await client.from('departments').select('id,slug').eq('slug',DEPARTMENT_SLUG).single();
  if(de)throw de;
  const {data,error}=await client.from('attendance_groups').select('id,group_name,recent_attendance,attendance,punctuality').eq('department_id',d.id);
  if(error)throw error;
  return sortedGroups(data||[]);
}
function countUp(el,target,duration=1000){return new Promise(resolve=>{const start=performance.now();function frame(now){const p=Math.min(1,(now-start)/duration),e=1-Math.pow(1-p,3);el.textContent=`${(target*e).toFixed(1)}%`;if(p<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});}
async function typeDecode(el,text,duration=650){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*';const steps=Math.max(1,Math.ceil(duration/35));for(let i=0;i<=steps;i++){const revealed=Math.floor(text.length*i/steps);let out=text.slice(0,revealed);if(revealed<text.length)out+=Array.from({length:text.length-revealed},()=>chars[Math.floor(Math.random()*chars.length)]).join('');el.textContent=out;await sleep(35);}el.textContent=text;}
function createParticles(root,count=90){const layer=document.createElement('div');layer.className='particle-layer';for(let i=0;i<count;i++){const p=document.createElement('i');p.className='particle';p.style.left=Math.random()*100+'%';p.style.top=(50+Math.random()*50)+'%';p.style.animationDelay=Math.random()*2+'s';p.style.animationDuration=(2+Math.random()*3)+'s';layer.appendChild(p);}root.appendChild(layer);}
function renderBoard(rows){const board=document.querySelector('#leaderboardBody');if(!board)return;board.innerHTML=rows.length?rows.map((g,i)=>`<div class="leader-row"><div class="rank">${i+1}</div><div class="group">${escapeHtml(g.group_name)}</div><div class="metric"><span>${pct(g.recent_attendance)}</span><small>RECENT ATTENDANCE</small></div><div class="metric"><span>${pct(g.attendance)}</span><small>OVERALL ATTENDANCE</small></div><div class="metric"><span>${pct(g.punctuality)}</span><small>PUNCTUALITY</small></div><div class="score-chip">${feedback(g)}</div></div>`).join(''):`<div class="status">No groups have been published yet.</div>`;}
async function runReveal(rows){const stage=document.querySelector('#podiumStage');if(!stage)return;document.body.classList.add('reveal-lock');window.scrollTo(0,0);const winners=rows.slice(0,3);const slots=[{n:3,cls:'third'},{n:2,cls:'second'},{n:1,cls:'first'}];for(const slot of slots){const g=winners[slot.n-1];if(!g)continue;const card=document.querySelector(`.${slot.cls}`);card.classList.add('active');await sleep(180);await typeDecode(card.querySelector('.winner-name'),g.group_name);await Promise.all([countUp(card.querySelector('.recent-val'),Number(g.recent_attendance),850),countUp(card.querySelector('.pun-val'),Number(g.punctuality),850)]);await sleep(300);}stage.classList.add('reveal-complete');document.body.classList.remove('reveal-lock');}
async function initPublic(){try{const rows=await getGroups();renderBoard(rows);createParticles(document.body,70);if(rows.length)await runReveal(rows);document.querySelector('#status').textContent=client?'Live leaderboard connected.':'Demo data loaded locally. Connect Supabase to use live data.';if(client){const {data:d}=await client.from('departments').select('id').eq('slug',DEPARTMENT_SLUG).single();if(d){client.channel(`live-${DEPARTMENT_SLUG}`).on('postgres_changes',{event:'*',schema:'public',table:'attendance_groups',filter:`department_id=eq.${d.id}`},async()=>{const r=await getGroups();renderBoard(r);}).subscribe();}}}catch(e){console.error(e);document.querySelector('#status').textContent='Unable to load live data. Demo data is shown instead.';const rows=sortedGroups(JSON.parse(JSON.stringify(demo)));renderBoard(rows);createParticles(document.body,70);await runReveal(rows);}}
window.AttendanceApp={client,getGroups,initPublic,renderBoard,escapeHtml,pct,score};
