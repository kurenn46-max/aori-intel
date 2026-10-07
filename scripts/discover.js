const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ROOT=path.resolve(__dirname,'..');
const DATA=path.join(ROOT,'data');
const cfg=JSON.parse(fs.readFileSync(path.join(DATA,'search-config.json'),'utf8'));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,16);
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
const stripTags=s=>normalize(String(s||'')
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' '));
const entities=s=>String(s||'')
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));

function jstParts(d=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const get=t=>parts.find(x=>x.type===t)?.value;
  return {year:Number(get('year')),month:Number(get('month')),day:Number(get('day'))};
}
function ymd(y,m,d){return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function parseDate(text='',pubDate=null){
  const now=jstParts();
  const full=[
    /(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/,
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/
  ];
  for(const rx of full){
    const m=text.match(rx);
    if(m)return {date:ymd(Number(m[1]),Number(m[2]),Number(m[3])),kind:'explicit_full'};
  }
  const md=text.match(/(?<!\d)(\d{1,2})[\/.月](\d{1,2})(?:日)?(?!\d)/);
  if(md && new RegExp(String(now.year)).test(text)){
    return {date:ymd(now.year,Number(md[1]),Number(md[2])),kind:'explicit_monthday'};
  }
  if(pubDate){
    const d=new Date(pubDate);
    if(!Number.isNaN(d.getTime())){
      const p=jstParts(d);
      return {date:ymd(p.year,p.month,p.day),kind:'search_pubdate'};
    }
  }
  return {date:null,kind:'unknown'};
}
function daysAgo(date){
  if(!date)return 9999;
  const t=new Date(date+'T00:00:00+09:00').getTime();
  const p=jstParts(); const n=new Date(ymd(p.year,p.month,p.day)+'T00:00:00+09:00').getTime();
  return Math.floor((n-t)/86400000);
}
function regionOf(text=''){
  if(/小名浜/.test(text) && !/(若狭|福井|敦賀|常神|高浜|美浜|舞鶴|宮津|越前)/.test(text))return null;
  let best=null,bestLen=0;
  for(const r of cfg.regions)for(const term of r.terms){
    if(text.includes(term) && term.length>bestLen){best=r.region;bestLen=term.length;}
  }
  return best;
}
function modeOf(text=''){
  if(/ティップラン|ボート|遊漁船|船中|船釣|沖釣|船で|筏|いかだ/i.test(text))return 'boat';
  if(/エギング|防波堤|堤防|漁港|波止|磯|地磯|サーフ|岸|ショア|テトラ/i.test(text))return 'shore';
  return 'unknown';
}
function methodOf(text=''){
  if(/ティップラン/i.test(text))return 'ティップラン';
  if(/ヤエン|泳がせ|活きアジ|活アジ/i.test(text))return 'ヤエン・泳がせ';
  if(/エギング|エギ/i.test(text))return 'エギング';
  return '不明';
}
function sizeOf(text=''){
  const w=text.match(/(\d{2,4})\s*g\b/i); if(w)return w[1]+'g';
  const kg=text.match(/(\d(?:\.\d+)?)\s*kg\b/i); if(kg)return kg[1]+'kg';
  const cm=text.match(/(?:胴長|サイズ)[^\d]{0,8}(\d{1,2})\s*cm/i); if(cm)return '胴長'+cm[1]+'cm';
  return null;
}
function countInfo(text=''){
  const windows=[];
  for(const m of text.matchAll(/アオリイカ|アオリ|秋イカ/g)){
    windows.push(text.slice(Math.max(0,m.index-140),Math.min(text.length,m.index+240)));
  }
  windows.push(text.slice(0,1800));
  const vals=[];
  for(const w of windows){
    const patterns=[
      /(?:アオリイカ|アオリ|釣果|キャッチ|ゲット)[^。\n]{0,90}?(\d{1,3})\s*(杯|匹)/g,
      /(\d{1,3})\s*(杯|匹)[^。\n]{0,90}?(?:アオリイカ|アオリ)/g,
      /(?:船中|合計|トータル)[^。\n]{0,50}?(\d{1,3})\s*(杯|匹)/g
    ];
    for(const rx of patterns)for(const m of w.matchAll(rx)){
      const n=Number(m[1]); if(n>=1&&n<=200)vals.push({n,context:normalize(m[0])});
    }
  }
  if(!vals.length)return {count:null,basis:'unknown',context:null};
  vals.sort((a,b)=>b.n-a.n);
  const v=vals[0];
  const basis=/船中|合計|トータル|全体/.test(v.context)?'boat_total':'reported';
  return {count:v.n,basis,context:v.context};
}
function canonical(url){
  try{
    const u=new URL(url); u.hash='';
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k=>u.searchParams.delete(k));
    return u.toString();
  }catch{return url;}
}
function domain(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}}
function sourceName(url){
  const d=domain(url);
  if(d.includes('anglers.jp'))return 'ANGLERS';
  if(d.includes('johshuya.co.jp'))return '上州屋';
  if(d.includes('ishiguro-gr.com'))return 'イシグロ';
  if(d.includes('yamaria.com'))return 'エギCOM';
  if(d.includes('ameblo.jp'))return 'Amebaブログ';
  if(d.includes('instagram.com'))return 'Instagram公開投稿';
  if(d.includes('youtube.com')||d.includes('youtu.be'))return 'YouTube';
  return d||'Web';
}
function trusted(url){const d=domain(url);return cfg.trusted_domains.some(x=>d===x||d.endsWith('.'+x));}
function rejected(url){const d=domain(url);return cfg.reject_domains.some(x=>d===x||d.endsWith('.'+x));}
function queryList(){
  const p=jstParts(); const ym=`${p.year} ${p.month}`;
  const out=[];
  for(const r of cfg.regions){
    const term=r.terms[0];
    for(const t of cfg.query_templates.slice(0,3))out.push(t.replace('{term}',term)+' '+ym);
  }
  out.push(...cfg.targeted_queries.map(q=>q+' '+p.year));
  return [...new Set(out)].slice(0,cfg.provider.max_queries||28);
}
function parseRss(xml,query){
  const items=[];
  const re=/<item>([\s\S]*?)<\/item>/gi; let m;
  while((m=re.exec(xml))){
    const b=m[1];
    const get=tag=>entities((b.match(new RegExp('<'+tag+'>([\\s\\S]*?)<\\/'+tag+'>','i'))||[])[1]||'')
      .replace(/^<!\[CDATA\[/,'').replace(/\]\]>$/,'');
    const url=canonical(stripTags(get('link')));
    if(!/^https?:\/\//.test(url)||rejected(url))continue;
    items.push({query,title:stripTags(get('title')),url,description:stripTags(get('description')),pubDate:stripTags(get('pubDate'))});
  }
  return items;
}
async function fetchText(url,timeout=12000){
  const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const r=await fetch(url,{redirect:'follow',signal:ctl.signal,headers:{
      'user-agent':'Mozilla/5.0 (compatible; AORI-INTEL/2.0; +https://github.com/kurenn46-max/aori-intel)',
      'accept-language':'ja,en;q=0.7'
    }});
    if(!r.ok)throw new Error(r.status+' '+r.statusText);
    const type=r.headers.get('content-type')||'';
    if(!/text|html|xml|json/.test(type))throw new Error('unsupported '+type);
    return await r.text();
  }finally{clearTimeout(timer);}
}
function candidateFrom(result,pageText){
  const combined=normalize([result.title,result.description,pageText].join(' '));
  const region=regionOf(combined);
  const mode=modeOf(combined);
  const method=methodOf(combined);
  const d=parseDate(combined,result.pubDate);
  const ci=countInfo(combined);
  const hasAori=/アオリイカ|アオリ(?!ゾメ)|秋イカ/.test(combined);
  const catchish=/釣果|釣れ|釣った|キャッチ|ゲット|ヒット|杯|匹|エギング|ティップラン/.test(combined);
  let score=0;
  if(hasAori)score+=3;
  if(region)score+=3;
  if(d.kind==='explicit_full')score+=3; else if(d.kind==='explicit_monthday')score+=2; else if(d.kind==='search_pubdate')score+=1;
  if(ci.count)score+=3;
  if(mode!=='unknown')score+=2;
  if(catchish)score+=1;
  if(trusted(result.url))score+=1;
  if(daysAgo(d.date)<=7)score+=1;
  if(/通販|商品|中古販売|ランキング|レシピ|図鑑|飼育/.test(combined))score-=4;
  const auto=score>=12 && hasAori && region && ci.count && mode!=='unknown' && d.kind==='explicit_full' && daysAgo(d.date)>=0 && daysAgo(d.date)<=30;
  return {
    id:'discover-'+hash(result.url+'|'+(d.date||'')+'|'+(region||'')+'|'+(ci.count||'')),
    query:result.query,title:result.title,url:result.url,domain:domain(result.url),
    date:d.date,date_source:d.kind,region,mode,method,count:ci.count,count_basis:ci.basis,
    size_text:sizeOf(combined),score,status:auto?'accepted':'candidate',
    source:sourceName(result.url),snippet:normalize(result.description||combined.slice(0,260)).slice(0,320),
    count_context:ci.context,checked_at:new Date().toISOString()
  };
}
function toCatch(c){
  return {
    id:c.id,date:c.date,time:null,region:c.region,subregion:c.region,mode:c.mode,method:c.method,
    place_type:c.mode==='boat'?'船/沖':'岸/詳細不明',catch_count:c.count,confirmed_events:null,
    claimed_count:null,count_source:c.count_basis==='boat_total'?'reported_boat_total':'reported_page',
    count_basis:c.count_basis,duration_hours:null,cpue:null,size_text:c.size_text,max_size_text:c.size_text,
    angler:null,confidence:'探索収集・本文確認',source:c.source,source_url:c.url,notes:c.snippet,
    verified:true,discovery:true,discovery_score:c.score
  };
}
function load(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function save(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}

async function main(){
  const queries=queryList();
  const searchResults=[]; const errors=[]; let searchesOk=0;
  for(const q of queries){
    try{
      const url=(cfg.provider.base_url||'https://www.bing.com/search?format=rss&q=')+encodeURIComponent(q);
      const xml=await fetchText(url,10000);
      const items=parseRss(xml,q); searchResults.push(...items); searchesOk++;
    }catch(e){errors.push({stage:'search',query:q,error:String(e).slice(0,180)});}
    await sleep(cfg.provider.delay_ms||500);
  }
  const uniq=[...new Map(searchResults.map(x=>[x.url,x])).values()];
  const ranked=uniq.sort((a,b)=>{
    const ta=trusted(a.url)?1:0,tb=trusted(b.url)?1:0; return tb-ta;
  }).slice(0,cfg.provider.fetch_limit||50);

  const candidates=[];
  for(const r of ranked){
    let page='';
    try{page=stripTags(await fetchText(r.url,12000));}
    catch(e){errors.push({stage:'fetch',url:r.url,error:String(e).slice(0,180)});}
    const c=candidateFrom(r,page);
    if(c.score>=5)candidates.push(c);
  }

  const current=load(path.join(DATA,'catches.json'),[]);
  const accepted=candidates.filter(x=>x.status==='accepted');
  const knownUrls=new Set(current.map(x=>x.source_url).filter(Boolean));
  const additions=accepted.filter(x=>!knownUrls.has(x.url)).map(toCatch);
  const cutoff=new Date(); cutoff.setUTCDate(cutoff.getUTCDate()-30); const cut=cutoff.toISOString().slice(0,10);
  const merged=[...current.filter(x=>x.is_user_data || !x.discovery || (x.date&&x.date>=cut)),...additions];
  const byId=new Map(); for(const x of merged)byId.set(x.id,x);
  const catches=[...byId.values()].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

  const prev=load(path.join(DATA,'discovery.json'),{candidates:[]});
  const combined=[...candidates,...(prev.candidates||[])];
  const byUrl=new Map();
  for(const x of combined){
    const key=x.url+'|'+(x.date||'')+'|'+(x.region||'');
    const old=byUrl.get(key); if(!old||x.score>old.score)byUrl.set(key,x);
  }
  const kept=[...byUrl.values()].filter(x=>!x.date||daysAgo(x.date)<=30).sort((a,b)=>b.score-a.score).slice(0,250);

  save(path.join(DATA,'catches.json'),catches);
  save(path.join(DATA,'discovery.json'),{updated_at:new Date().toISOString(),candidates:kept});
  save(path.join(DATA,'discovery-status.json'),{
    checked_at:new Date().toISOString(),provider:cfg.provider.type||'bing_rss',
    queries_planned:queries.length,queries_ok:searchesOk,raw_results:searchResults.length,
    unique_results:uniq.length,pages_attempted:ranked.length,candidates:candidates.length,
    accepted:accepted.length,new_catches:additions.length,errors:errors.slice(0,30),
    sample_queries:queries.slice(0,8)
  });
  console.log(JSON.stringify({queries:queries.length,searchesOk,raw:searchResults.length,unique:uniq.length,candidates:candidates.length,accepted:accepted.length,new:additions.length,errors:errors.length}));
}

module.exports={queryList,parseRss,parseDate,regionOf,modeOf,methodOf,countInfo,candidateFrom};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
