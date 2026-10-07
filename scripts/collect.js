const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const REGION_RULES = [
  {region:'高浜', patterns:[/高浜/,/音海/,/内浦/,/和田/ ]},
  {region:'小浜湾', patterns:[/小浜(?!名浜)/,/泊/,/堅海/,/犬熊/,/宇久/ ]},
  {region:'常神半島', patterns:[/常神/,/小川漁港/,/小川付近/,/神子/,/世久見/ ]},
  {region:'美浜', patterns:[/美浜/,/日向/,/菅浜/ ]},
  {region:'敦賀', patterns:[/敦賀/,/白木/,/色ヶ浜/ ]},
  {region:'舞鶴', patterns:[/舞鶴/,/白杉/,/小橋/ ]},
  {region:'宮津', patterns:[/宮津/,/栗田/,/伊根/ ]},
  {region:'越前', patterns:[/越前/,/厨/,/梅浦/ ]}
];

const BAIT_SPECIES = ['ジンタ','豆アジ','小アジ','アジ','イワシ','カタクチイワシ','マイワシ','ウルメイワシ','サヨリ','キビナゴ','小サバ','サバ'];
const PREDATOR_SPECIES = ['サゴシ','サワラ','ツバス','ハマチ','ブリ','カンパチ','シーバス','スズキ','カマス'];
const OTHER_SPECIES = ['アオリイカ','シイラ','カジキ','ヒラメ','マダイ','タイ','カワハギ','ウチワハギ','タコ','ガザミ','シロサバフグ','スルメイカ','ヤリイカ'];

function normalizeSpace(s='') { return s.replace(/\s+/g,' ').trim(); }
function stripTags(s='') { return normalizeSpace(s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"')); }
function idFor(parts) { return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0,16); }
function classifyMode(place='') {
  if (/ボート|船|筏|いかだ|ティップラン/i.test(place)) return 'boat';
  if (/防波堤|磯|サーフ|ゴロタ|河川|港|堤防|岸|波止/i.test(place)) return 'shore';
  return 'unknown';
}
function normalizeRegion(text='') {
  if (/小名浜/.test(text)) return null;
  for (const rule of REGION_RULES) if (rule.patterns.some(p=>p.test(text))) return rule.region;
  return null;
}
function ordinalClaim(text='') {
  const m = text.match(/(?:本日|今日|今季)?\s*(\d{1,2})\s*(?:杯|匹)目/);
  return m ? Number(m[1]) : null;
}
function weightRank(s='') {
  const table = {'100g以下':1,'100g〜300g':2,'100g～300g':2,'300g〜500g':3,'300g～500g':3,'500g〜800g':4,'500g～800g':4,'800g〜1kg':5,'800g～1kg':5,'1kg以上':6};
  return table[s] || 0;
}
function extractAnchors(html='') {
  const out=[];
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m=re.exec(html))) out.push({href:m[1], text:stripTags(m[2])});
  return out;
}
function parseYamaria(html, source) {
  const events=[];
  for (const a of extractAnchors(html)) {
    const t=normalizeSpace(a.text);
    if (!/アオリイカ\s*：/.test(t) || !t.includes('釣果場所：')) continue;
    const m=t.match(/^(\d+)\s*HIT\s+(.+?)\s+さん\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+アオリイカ\s*：\s*([^ ]+)\s+釣果場所：\s*福井\s+([^ ]+)\s+釣り場所：([^ #]+)(?:\s+(.*))?$/);
    if (!m) continue;
    const [,hit, angler,date,time,size,city,placeType,comment=''] = m;
    const region = normalizeRegion(city) || source.region || city;
    if (!region || /小名浜/.test(city)) continue;
    const mode=classifyMode(placeType);
    const url=a.href.startsWith('http') ? a.href : new URL(a.href, source.url).toString();
    events.push({
      id:`yamaria-event-${idFor([url,date,time,angler])}`,
      date,time,region,subregion:city,mode,method:'エギング',place_type:placeType,
      catch_count:1, confirmed_events:1, count_source:'posted_event', size_text:size,
      claimed_count:ordinalClaim(comment), angler, confidence:'写真付き実釣',
      source:source.name, source_url:url, notes:comment || null, verified:true,
      raw_hit:Number(hit)
    });
  }
  if (events.length) return events;

  // Fallback: some responses flatten the latest cards instead of exposing the same anchor markup.
  // HIT is engagement, never catch count.
  const flat=stripTags(html);
  const re=/(\d+)\s*HIT\s+(.+?)\s+さん\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+アオリイカ\s*：\s*([^ ]+)\s+釣果場所：\s*福井\s+([^ ]+)\s+釣り場所：([^ #]+)(?:\s+(.*?))?(?=\s+\d+\s*HIT\s+.+?\s+さん\s+\d{4}-\d{2}-\d{2}|$)/g;
  let m;
  while ((m=re.exec(flat))) {
    const hit=m[1], angler=m[2], date=m[3], time=m[4], size=m[5], city=m[6], placeType=m[7], comment=m[8]||'';
    const region=normalizeRegion(city)||source.region||city;
    if (!region || /小名浜/.test(city)) continue;
    events.push({
      id:'yamaria-flat-'+idFor([source.url,date,time,angler,city,placeType]),
      date,time,region,subregion:city,mode:classifyMode(placeType),method:'エギング',place_type:placeType,
      catch_count:1,confirmed_events:1,count_source:'posted_event',size_text:size,
      claimed_count:ordinalClaim(comment),angler,confidence:'公開一覧実釣',
      source:source.name,source_url:source.url,notes:normalizeSpace(comment)||null,verified:true,
      raw_hit:Number(hit)
    });
  }
  return events;
}

function groupSessions(events) {
  const groups = new Map();
  const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
  const sorted=[...events].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  for (const ev of sorted) {
    const key=[ev.source,ev.angler,ev.date,ev.region,ev.mode,ev.place_type].join('|');
    const arr=groups.get(key)||[];
    const last=arr.at(-1)?.at(-1);
    if (!last || Math.abs(toMin(ev.time)-toMin(last.time))>180) arr.push([ev]);
    else arr[arr.length-1].push(ev);
    groups.set(key,arr);
  }
  const sessions=[];
  for (const arrs of groups.values()) for (const arr of arrs) {
    const first=arr[0], last=arr[arr.length-1];
    const claims=arr.map(x=>x.claimed_count).filter(Number.isFinite);
    const claim=claims.length?Math.max(...claims):null;
    const confirmed=arr.length;
    const count=claim && claim>confirmed ? claim : confirmed;
    const countSource=claim && claim>confirmed ? 'claimed_ordinal' : 'posted_events';
    const ranks=[...arr].sort((a,b)=>weightRank(b.size_text)-weightRank(a.size_text));
    const firstMin=toMin(first.time), lastMin=toMin(last.time);
    const duration=lastMin>=firstMin ? (lastMin-firstMin)/60 : null;
    sessions.push({
      id:`session-${idFor(arr.map(x=>x.id))}`,
      date:first.date,
      time: first.time===last.time ? first.time : `${first.time}〜${last.time}`,
      region:first.region, subregion:first.subregion, mode:first.mode, method:first.method,
      place_type:first.place_type, catch_count:count, confirmed_events:confirmed,
      claimed_count:claim, count_source:countSource,
      duration_hours:duration>0?Number(duration.toFixed(2)):null,
      cpue: duration>0 && countSource==='posted_events' ? Number((confirmed/duration).toFixed(2)) : null,
      size_text:[...new Set(arr.map(x=>x.size_text))].join(' / '),
      max_size_text:ranks[0]?.size_text || null,
      angler:first.angler, confidence:first.confidence, source:first.source,
      source_url:last.source_url, notes:arr.map(x=>x.notes).filter(Boolean).join(' / ') || null,
      verified:true, event_ids:arr.map(x=>x.id)
    });
  }
  return sessions;
}

function extractDate(text='') {
  let m=text.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (!m) m=text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}
function speciesFromText(text='') {
  const names=[...new Set([...BAIT_SPECIES,...PREDATOR_SPECIES,...OTHER_SPECIES])].sort((a,b)=>b.length-a.length);
  const found=[]; let masked=text;
  for (const name of names) {
    const pattern='(?<![一-龯ぁ-んァ-ヶー])'+name+'(?![一-龯ぁ-んァ-ヶー])';
    const rx=new RegExp(pattern,'u');
    if (!rx.test(masked)) continue;
    found.push({
      name,
      signal: name==='アオリイカ'?'target':BAIT_SPECIES.includes(name)?'direct_bait':PREDATOR_SPECIES.includes(name)?'indirect_predator_signal':'other',
      amount:null
    });
    masked=masked.replace(new RegExp(pattern,'gu'),' ');
  }
  return found;
}
function parseJfObama(html, source) {
  const text=stripTags(html); const rows=[];
  const re=/(20\d{2}\.\d{1,2}\.\d{1,2})\s+([^]*?)(?=20\d{2}\.\d{1,2}\.\d{1,2}|$)/g;
  let m;
  while ((m=re.exec(text))) {
    const date=extractDate(m[1]); const body=normalizeSpace(m[2]);
    if (!/定置/.test(body)) continue;
    const species=speciesFromText(body);
    const explicit=[];
    for (const name of [...BAIT_SPECIES,...PREDATOR_SPECIES,'アオリイカ','シイラ']) {
      const rx=new RegExp(`定置[^。]*${name}|${name}[^。]*定置`);
      if (rx.test(body)) explicit.push(name);
    }
    rows.push({
      id:`setnet-jf-${date}`,
      date,region:'小浜湾',fishery:'小浜市漁協 市場水揚げ',gear:'定置網',
      gear_attribution: explicit.length ? 'species_explicit' : 'mixed_or_general',
      aori_present: explicit.includes('アオリイカ'),
      species:species.filter(s=>explicit.includes(s.name)),
      source:source.name,source_url:source.url,
      confidence:explicit.length?'定置対象魚種が本文で明示':'定置水揚げあり・魚種帰属は限定',
      notes:body.slice(0,240)
    });
  }
  return rows;
}
function parseWakasaArticle(html, url, source) {
  const fullText=stripTags(html);
  const text=fullText.split(/よかったらシェア/)[0];
  const date=extractDate(text);
  if (!date || !/定置網/.test(text)) return null;
  const mixed=/底曳|底引|延縄/.test(text);
  let confirmedOnly = /定置網は[^。]*だけ/.test(text) || /漁は[、,:：\s]*定置網[。\s]/.test(text);
  if (mixed && !/定置網は[^。]*だけ/.test(text)) confirmedOnly=false;
  const fisheryMatch=text.match(/定置網は([^。]+?)だけ/);
  const fishery=fisheryMatch?fisheryMatch[1].replace(/と/g,'・').trim():'定置網';
  const species=speciesFromText(text);
  return {
    id:`setnet-wakasa-${idFor([date,url])}`,date,region:'小浜湾・若狭町',fishery,gear:'定置網',
    gear_attribution:confirmedOnly?'confirmed':'mixed_or_general',
    aori_present:confirmedOnly && species.some(s=>s.name==='アオリイカ'),
    species:confirmedOnly?species:[], source:source.name,source_url:url,
    confidence:confirmedOnly?'定置網帰属が記事で明示':'定置と他漁法が混在し魚種帰属不能',
    notes:confirmedOnly?'数量は明記分のみ。未公表量は補完しない。':'混合集荷のため定置網指標には算入しない。'
  };
}



function parseUosoku(html, source) {
  const text=stripTags(html);
  const body=text.split(/福井県のおすすめ釣りスポット|本日の激熱釣果情報/)[0];
  const anchors=extractAnchors(html).map(a=>({
    href:a.href.startsWith('http')?a.href:new URL(a.href,source.url).toString(),
    text:normalizeSpace(a.text)
  }));
  const dateRe=/(20\d{2}-\d{2}-\d{2})推定都道府県:\s*福井県/g;
  const marks=[]; let m;
  while((m=dateRe.exec(body))) marks.push({date:m[1],idx:m.index,end:dateRe.lastIndex});
  const rows=[];
  for(let i=0;i<marks.length;i++){
    const cur=marks[i], next=marks[i+1]?.idx ?? body.length;
    const before=body.slice(Math.max(0,cur.idx-260),cur.idx);
    const meta=normalizeSpace(body.slice(cur.end,Math.min(next,cur.end+900)));
    if(!/関連魚種:\s*[^。]{0,160}アオリイカ/.test(meta) && !/アオリイカ/.test(meta)) continue;

    let title=normalizeSpace(before
      .replace(/##\s*20\d{2}年\d{1,2}月の釣果情報/g,' ')
      .replace(/アオリイカ福井県/g,' ')
      .replace(/エギング×福井県|ティップラン×福井県|船釣り×福井県/g,' '));
    const cuts=['アオリイカ ','福井県 ','Click '];
    for(const k of cuts){const p=title.lastIndexOf(k);if(p>=0 && title.length-p>30) title=title.slice(p+k.length);}
    title=title.slice(-180).trim();
    if(!title) title='アオリイカ釣果情報';

    const combined=title+' '+meta;
    let region=normalizeRegion(combined);
    if(!region){
      if(/泰丸/.test(combined)) region='敦賀';
      else if(/美浜沖|美浜町|早瀬/.test(combined)) region='美浜';
      else if(/小浜市|小浜湾|小浜新港|西小川/.test(combined)) region='小浜湾';
      else if(/高浜町|音海/.test(combined)) region='高浜';
    }

    let mode='unknown';
    if(/ソルトオフショア|ティップラン|ボートエギング|船釣り|遊漁船|筏/.test(combined)) mode='boat';
    if(/ソルト陸っぱり|エギング/.test(combined) && !/ソルトオフショア|ティップラン|ボートエギング|船釣り/.test(combined)) mode='shore';

    let method='不明';
    if(/ティップラン/.test(combined)) method='ティップラン';
    else if(/ヤエン/.test(combined)) method='ヤエン';
    else if(/エギング/.test(combined)) method='エギング';

    let count=null, countBasis='unknown';
    const countPatterns=[
      /アオリイカ[^\d]{0,35}(\d{1,3})\s*(?:匹|杯)/,
      /(?:合計|竿頭)[^\d]{0,12}(\d{1,3})\s*(?:匹|杯)/,
      /(\d{1,3})\s*(?:匹|杯)[^。]{0,40}アオリイカ/
    ];
    for(const rx of countPatterns){
      const cm=combined.match(rx);
      if(cm){const n=Number(cm[1]);if(n>=1&&n<=200){count=n;countBasis=/船中|合計/.test(cm[0])?'boat_total':'reported';break;}}
    }

    const sourceM=meta.match(/情報元:\s*([^\d]{1,100}?)(?:\s+\d+Click|\s+Click|$)/);
    const originName=normalizeSpace(sourceM?.[1]||'魚速');
    const titleAnchor=anchors.find(a=>a.text && (title.includes(a.text)||a.text.includes(title.slice(0,Math.min(35,title.length)))) && !/uosoku\.com/.test(a.href));
    const originUrl=titleAnchor?.href || source.url;

    const sizeCm=[...combined.matchAll(/(\d{1,2})\s*[-〜～]\s*(\d{1,2})\s*cm/g)];
    const sizeText=sizeCm.length?`${sizeCm[0][1]}〜${sizeCm[0][2]}cm`:null;

    rows.push({
      id:`uosoku-${idFor([cur.date,originName,title,region||'',mode])}`,
      date:cur.date,time:null,region:region||'福井県',subregion:region||'福井県',
      mode,method,place_type:mode==='boat'?'沖/船':'詳細不明',
      catch_count:count,confirmed_events:null,claimed_count:null,
      count_source:count?'uosoku_index_report':'report_only',
      count_basis:countBasis,duration_hours:null,cpue:null,size_text:sizeText,max_size_text:sizeText,
      angler:null,confidence:'魚速索引・原文確認推奨',
      source:`魚速 / ${originName}`,source_url:originUrl,
      notes:normalizeSpace(title+' / '+meta).slice(0,360),
      verified:false,discovery:true
    });
  }
  return dedupe(rows).filter(x=>{
    const d=new Date(x.date+'T00:00:00+09:00').getTime();
    return Number.isFinite(d) && (Date.now()-d)<=35*86400000 && (Date.now()-d)>=-86400000;
  });
}

function parseAnglersFishing(html,url,source,areaDef={}) {
  const text=stripTags(html);
  const start=text.indexOf('釣行の概要');
  const end=text.indexOf('この釣行の釣り人について');
  const main=(start>=0?text.slice(start,end>start?end:Math.min(text.length,start+7000)):text.slice(0,7000));
  if(!/アオリイカ/.test(main)) return null;

  const dm=main.match(/日時\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日[^0-9]{0,12}(\d{2}:\d{2})(?:\s*[〜～~\-]\s*(\d{2}:\d{2}))?/);
  if(!dm) return null;
  const date=`${dm[1]}-${String(dm[2]).padStart(2,'0')}-${String(dm[3]).padStart(2,'0')}`;
  const timeStart=dm[4], timeEnd=dm[5]||dm[4];

  const contentStart=main.indexOf('釣行の内容');
  const content=contentStart>=0?main.slice(contentStart):main;
  let count=(content.match(/アオリイカ/g)||[]).length;
  if(!count) count=1;

  const am=main.match(/釣り人\s+(.+?)\s+日時/);
  const areaM=main.match(/エリア\s+(.+?)\s+(?:潮名|マップ|釣行の内容|$)/);
  const subregion=normalizeSpace(areaM?.[1]||areaDef.name||areaDef.region||source.region||'');
  const region=normalizeRegion(subregion)||areaDef.region||source.region||'不明';

  let mode='unknown';
  if(/ティップラン|ボート|遊漁船|船中|船釣/.test(main)) mode='boat';
  else if(/エギング|エギ|ヤエン|泳がせ|漁港|防波堤|堤防|磯|波止/.test(main+' '+subregion)) mode='shore';
  else if(/漁港|港$/.test(subregion)) mode='shore';
  if(mode==='unknown' && areaDef.default_mode) mode=areaDef.default_mode;

  let method='不明';
  if(/ティップラン/.test(main)) method='ティップラン';
  else if(/ヤエン|泳がせ|活きアジ|活アジ/.test(main)) method='ヤエン・泳がせ';
  else if(/エギング|エギ王|餌木|エギ/.test(main)) method='エギング';

  const cm=[...main.matchAll(/(\d{1,2}(?:\.\d+)?)\s*cm/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  const g=[...main.matchAll(/(\d{2,4}(?:\.\d+)?)\s*g\b/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  const sizeParts=[];
  if(cm.length) sizeParts.push(`最大${Math.max(...cm)}cm`);
  if(g.length) sizeParts.push(`最大${Math.max(...g)}g`);

  const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
  let dur=toMin(timeEnd)-toMin(timeStart); if(dur<0) dur+=1440;
  const hours=dur>0?Number((dur/60).toFixed(2)):null;
  const time=timeStart===timeEnd?timeStart:`${timeStart}〜${timeEnd}`;

  return {
    id:`anglers-fishing-${idFor([url,date])}`,
    date,time,region,subregion,mode,method,
    place_type:subregion,
    catch_count:count,confirmed_events:count,claimed_count:null,
    count_source:'anglers_fishing_events',
    duration_hours:hours,
    cpue:hours?Number((count/hours).toFixed(2)):null,
    size_text:sizeParts.join(' / ')||null,
    max_size_text:sizeParts.join(' / ')||null,
    angler:normalizeSpace(am?.[1]||'')||null,
    confidence:mode==='unknown'?'ANGLERS公開釣行・釣法不明':'ANGLERS公開釣行',
    source:'ANGLERS',source_url:url,
    notes:normalizeSpace(content).slice(0,260),
    verified:true
  };
}

async function collectAnglersAreas(source) {
  const rows=[]; const seen=new Set();
  for(const area of source.areas||[]){
    try{
      const html=await fetchText(area.url);
      const links=extractAnchors(html)
        .map(a=>a.href.startsWith('http')?a.href:new URL(a.href,area.url).toString())
        .filter(u=>/anglers\.jp\/fishings\/\d+/.test(u));
      if(process.env.DEBUG_ANGLERS==='1') console.log('ANGLERS_AREA',area.name,'len='+html.length,'links='+links.length,stripTags(html).slice(0,900));
      for(const url of [...new Set(links)].slice(0,area.limit||6)){
        if(seen.has(url)) continue; seen.add(url);
        try{
          const page=await fetchText(url);
          const row=parseAnglersFishing(page,url,source,area);
          if(process.env.DEBUG_ANGLERS==='1') console.log('ANGLERS_FISHING',url,'len='+page.length,'aori='+(stripTags(page).match(/アオリイカ/g)||[]).length,'parsed='+(row?'yes':'no'));
          if(row) rows.push(row);
        }catch{}
      }
    }catch{}
  }
  return rows;
}

async function fetchText(url) {
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 AORI-INTEL/1.0 (+GitHub Actions)'}});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}
function loadJson(file,fallback) { try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function saveJson(file,data){fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
function dedupe(items){const m=new Map();for(const x of items)m.set(x.id,x);return [...m.values()];}

async function collect() {
  const registry=loadJson(path.join(DATA,'source-registry.json'),{sources:[]});
  const currentCatches=loadJson(path.join(DATA,'catches.json'),[]);
  const currentSetnet=loadJson(path.join(DATA,'setnet.json'),[]);
  const status=[]; let newSessions=[]; let newSetnet=[];
  for(const source of registry.sources.filter(s=>s.enabled)){
    const st={source:source.name,checked_at:new Date().toISOString(),status:'ok',new_count:0,note:null};
    try{
      if(source.adapter==='yamaria'){
        const html=await fetchText(source.url); if(process.env.DEBUG_YAMARIA==='1'){const plain=stripTags(html);console.log('YAMARIA_DEBUG',source.name,'len='+html.length,'aori='+(plain.match(/アオリイカ/g)||[]).length,plain.slice(Math.max(0,plain.indexOf('最新釣果投稿')-200),Math.max(0,plain.indexOf('最新釣果投稿')-200)+3500));} const events=parseYamaria(html,source); const sessions=groupSessions(events);
        newSessions.push(...sessions); st.new_count=sessions.length;
        if(!sessions.length){
          if(/アオリイカ\s*：/.test(stripTags(html))){st.status='error';st.note='釣果表示はあるが解析できず。no_new扱いにはしない。';}
          else st.status='no_new';
        }
      } else if(source.adapter==='uosoku'){
        const html=await fetchText(source.url); const rows=parseUosoku(html,source);
        newSessions.push(...rows); st.new_count=rows.length;
        if(!rows.length){st.status='no_new';st.note='魚速の公開一覧から直近アオリ情報を抽出できず';}
      } else if(source.adapter==='anglers_areas'){
        const rows=await collectAnglersAreas(source); newSessions.push(...rows); st.new_count=rows.length;
        if(!rows.length){st.status='blocked';st.note='GitHub Actionsから公開エリア本文が空レスポンス。探索検索側で補完';}
      } else if(source.adapter==='jf_obama'){
        const html=await fetchText(source.url); const rows=parseJfObama(html,source); newSetnet.push(...rows); st.new_count=rows.length; if(!rows.length)st.status='no_new';
      } else if(source.adapter==='wakasa_osakana'){
        const listHtml=await fetchText(source.url); const links=extractAnchors(listHtml)
          .map(a=>a.href.startsWith('http')?a.href:new URL(a.href,source.url).toString())
          .filter(u=>/seiza-design\.com\/blog\/archives\/\d+/.test(u));
        const uniq=[...new Set(links)].slice(0,8); let n=0;
        for(const url of uniq){ try{ const row=parseWakasaArticle(await fetchText(url),url,source); if(row){newSetnet.push(row);n++;} }catch{} }
        st.new_count=n; if(!n)st.status='no_new';
      }
    }catch(e){st.status=/401|403|429/.test(String(e))?'blocked':'error';st.note=String(e).slice(0,200);}
    status.push(st);
  }
  // Keep user data indefinitely and retain auto records for 30 days so entries do not disappear when they fall off a source's latest list.
  const cutoff=new Date(); cutoff.setUTCDate(cutoff.getUTCDate()-30); const cutoffDate=cutoff.toISOString().slice(0,10);
  const kept=currentCatches.filter(x=>x.is_user_data || (x.date && x.date>=cutoffDate));
  const catches=dedupe([...kept,...newSessions]).sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const setnet=dedupe([...currentSetnet.filter(x=>x.source==='ユーザー実釣'),...newSetnet]).sort((a,b)=>b.date.localeCompare(a.date));
  saveJson(path.join(DATA,'catches.json'),catches);
  saveJson(path.join(DATA,'setnet.json'),setnet);
  saveJson(path.join(DATA,'source-status.json'),{checked_at:new Date().toISOString(),sources:status});
  console.log(`catches=${catches.length} setnet=${setnet.length}`);
}

module.exports={normalizeSpace,stripTags,classifyMode,normalizeRegion,ordinalClaim,parseYamaria,groupSessions,parseJfObama,parseWakasaArticle,parseAnglersFishing,parseUosoku,speciesFromText};
if(require.main===module) collect().catch(e=>{console.error(e);process.exit(1);});
