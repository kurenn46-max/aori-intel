const state={mode:'shore',days:7,region:'全地域',query:'',catches:[],setnet:[],status:{checked_at:null,sources:[]}};
const regions=['全地域','高浜','小浜湾','常神半島','美浜','敦賀','舞鶴','宮津','越前'];
const $=s=>document.querySelector(s);
const fmtDate=(d,t)=>`${d.replaceAll('-','/')} ${t||''}`.trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayJst=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const daysDiff=(a,b)=>Math.round((new Date(`${a}T00:00:00+09:00`)-new Date(`${b}T00:00:00+09:00`))/86400000);

async function json(url,fallback){try{const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch{return fallback;}}
async function load(){
  $('#statusStrip').textContent='最新データを読み込み中…';
  const [catches,setnet,status]=await Promise.all([json('data/catches.json',[]),json('data/setnet.json',[]),json('data/source-status.json',{checked_at:null,sources:[]})]);
  state.catches=catches;state.setnet=setnet;state.status=status;render();
}
function selectedRecords(){
  const today=todayJst();
  let rows=state.mode==='setnet'?state.setnet:state.catches.filter(x=>x.mode===state.mode);
  rows=rows.filter(x=>{
    const dd=-daysDiff(x.date,today);
    if(state.days===0 && dd!==0)return false;
    if(state.days===1 && dd!==1)return false;
    if(state.days>1 && (dd<0||dd>=state.days))return false;
    if(state.region!=='全地域' && !`${x.region} ${x.subregion||''} ${x.fishery||''}`.includes(state.region))return false;
    if(state.query){const hay=JSON.stringify(x).toLowerCase();if(!hay.includes(state.query.toLowerCase()))return false;}
    return true;
  });
  return rows.sort((a,b)=>`${b.date} ${b.time||''}`.localeCompare(`${a.date} ${a.time||''}`));
}
function renderRegions(){
  $('#regionTabs').innerHTML=regions.map(r=>`<button class="${state.region===r?'active':''}" data-region="${r}">${r}</button>`).join('');
  $('#regionTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.region=b.dataset.region;render();});
}
function summaryCards(rows){
  if(state.mode==='setnet'){
    const confirmed=rows.filter(x=>x.gear_attribution==='confirmed');
    const aori=confirmed.filter(x=>x.aori_present).length;
    const bait=[...new Set(confirmed.flatMap(x=>(x.species||[]).filter(s=>s.signal==='direct_bait').map(s=>s.name)))];
    const pred=[...new Set(confirmed.flatMap(x=>(x.species||[]).filter(s=>s.signal==='indirect_predator_signal').map(s=>s.name)))];
    return [
      ['定置網記録',confirmed.length,'帰属確認済み'],['アオリ入網日',aori,'数量不明は補完しない'],['ベイト魚種',bait.length,bait.slice(0,3).join('・')||'確認なし'],['捕食魚種',pred.length,pred.slice(0,3).join('・')||'確認なし']
    ];
  }
  const counts=rows.map(x=>Number(x.catch_count)||0); const max=Math.max(0,...counts);
  const sessions=rows.length; const multi=rows.filter(x=>(x.catch_count||0)>=3).length;
  const knownCpue=rows.map(x=>x.cpue).filter(Number.isFinite); const best=knownCpue.length?Math.max(...knownCpue):null;
  return [
    ['確認釣行',sessions,'重複統合後'],['1人最多',max?`${max}杯`:'–','本人表記は別管理'],['3杯以上',multi,'釣行'],['最高CPUE',best?`${best}/h`:'–','時間判明分のみ']
  ];
}
function analysis(rows){
  if(!rows.length)return ['材料不足','条件に合う確認データがありません。投稿数の少なさを、そのまま魚影の薄さとは判断しません。','neutral'];
  if(state.mode==='setnet'){
    const confirmed=rows.filter(x=>x.gear_attribution==='confirmed'); const aori=confirmed.some(x=>x.aori_present);
    const bait=[...new Set(confirmed.flatMap(x=>(x.species||[]).filter(s=>s.signal==='direct_bait').map(s=>s.name)))];
    const pred=[...new Set(confirmed.flatMap(x=>(x.species||[]).filter(s=>s.signal==='indirect_predator_signal').map(s=>s.name)))];
    let txt=`定置網帰属を確認できた記録は${confirmed.length}件。`;
    txt+=aori?'アオリイカの入網あり。':'アオリイカ入網は確認できず。';
    if(bait.length)txt+=` ベイト指標は${bait.join('・')}。`;
    if(pred.length)txt+=` 捕食魚は${pred.join('・')}が確認材料。`;
    txt+=' 定置網は設置場所と潮流の影響が大きいため、岸釣果の杯数には混ぜません。';
    return [aori?'回遊材料あり':'定置網材料',txt,aori?'good':'neutral'];
  }
  const max=Math.max(...rows.map(x=>x.catch_count||0)); const good=rows.filter(x=>(x.catch_count||0)>=5).length; const user=rows.find(x=>x.is_user_data);
  let txt=`直近条件内の最多は${max}杯。5杯以上の確認釣行は${good}件。`;
  if(user)txt+=` 本人実釣では${user.subregion}で${user.catch_count}杯、同行者${user.companion_catch_count??'不明'}杯。`;
  if(state.mode==='boat')txt+=' 船釣果は沖の魚影・水深の参考に使い、岸の好調判定には加えません。';
  else txt+=' 1人1釣行の杯数を優先し、単発投稿数だけで好調判定しません。';
  return [good>=2?'数釣り材料あり':max>=3?'局地反応あり':'単発中心',txt,good>=2?'good':max>=3?'warn':'neutral'];
}
function renderSummary(rows){
  $('#summary').innerHTML=summaryCards(rows).map(([k,v,s])=>`<div class="summary card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('');
  const [label,txt,cls]=analysis(rows);$('#evidencePill').textContent=label;$('#evidencePill').className=`pill ${cls}`;$('#analysisText').textContent=txt;
}
function recordCard(x){
  if(state.mode==='setnet'){
    const species=(x.species||[]).map(s=>s.name).join('・')||'魚種帰属なし';
    const badge=x.gear_attribution==='confirmed'?'定置網帰属確認':'混合集荷';
    return `<article class="record card"><div class="record-top"><div><div class="record-date">${esc(fmtDate(x.date,''))}</div><h3>${esc(x.fishery||x.region)}</h3></div><span class="confidence pill ${x.gear_attribution==='confirmed'?'good':'neutral'}">${badge}</span></div><div class="metrics"><span class="metric"><b>${x.aori_present?'アオリあり':'アオリ未確認'}</b></span><span class="metric">${esc(species)}</span></div><p class="record-notes">${esc(x.notes||'')}</p><div class="record-foot"><span>${esc(x.source||'')}</span>${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">出典</a>`:''}</div></article>`;
  }
  const countLabel=x.count_source==='claimed_ordinal'?`${x.catch_count}杯（本人表記）`:`${x.catch_count??'–'}杯`;
  const ev=x.confirmed_events!=null?`写真/投稿確認 ${x.confirmed_events}`:'';
  const cp=x.cpue?`CPUE ${x.cpue}/h`:'';
  const tags=[`<span class="metric"><b>${esc(countLabel)}</b></span>`,x.size_text?`<span class="metric">${esc(x.size_text)}</span>`:'',x.method?`<span class="metric">${esc(x.method)}</span>`:'',cp?`<span class="metric">${esc(cp)}</span>`:'',ev?`<span class="metric">${esc(ev)}</span>`:''].filter(Boolean).join('');
  return `<article class="record card"><div class="record-top"><div><div class="record-date">${esc(fmtDate(x.date,x.time))}</div><h3>${esc(x.subregion||x.region)}${x.place_type?`・${esc(x.place_type)}`:''}</h3></div><span class="confidence pill ${x.is_user_data?'good':'neutral'}">${esc(x.confidence||'確認済み')}</span></div><div class="metrics">${tags}</div><p class="record-notes">${esc(x.notes||'')}</p><div class="record-foot"><span>${esc(x.source||'')}</span>${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">出典</a>`:''}</div></article>`;
}
function renderSources(){
  const s=state.status.sources||[]; const checked=state.status.checked_at?new Date(state.status.checked_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'未実行';
  $('#sourceStatus').innerHTML=`<p class="fineprint">最終巡回: ${esc(checked)}</p>`+(s.length?s.map(x=>`<div class="source-row"><span>${esc(x.source)}</span><span class="status-${esc(x.status)}">${esc(x.status)}${x.new_count!=null?` / ${x.new_count}`:''}</span></div>`).join(''):'<div class="source-row"><span>GitHub Actions初回実行待ち</span><span class="status-no_new">seed</span></div>');
}
function render(){
  renderRegions(); const rows=selectedRecords(); renderSummary(rows);
  const names={shore:'岸釣果',boat:'船釣果',setnet:'定置網情報'}; $('#listTitle').textContent=`最新の${names[state.mode]}`;$('#resultCount').textContent=`${rows.length}件`;
  $('#records').innerHTML=rows.length?rows.map(recordCard).join(''):'<div class="empty card">条件に合う確認データなし</div>';
  const checked=state.status.checked_at?new Date(state.status.checked_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'初回自動巡回前';
  $('#statusStrip').textContent=`${state.region} / ${state.days===0?'今日':state.days===1?'昨日':state.days+'日'} / ${checked}`;
  renderSources();
  document.querySelectorAll('#modeTabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
  document.querySelectorAll('#rangeTabs button').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===state.days));
}
document.addEventListener('DOMContentLoaded',()=>{
  $('#modeTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;render();});
  $('#rangeTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.days=Number(b.dataset.days);render();});
  $('#searchInput').oninput=e=>{state.query=e.target.value.trim();render();};
  $('#refreshBtn').onclick=load;
  load();
});
