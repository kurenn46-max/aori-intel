'use strict';
const crypto=require('node:crypto');
const DAY=86400000;
function strip(html=''){
 return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
  .replace(/\s+/g,' ').trim();
}
function detailLinks(html,base,limit=12){
 const host=new URL(base).hostname;
 const seen=new Set(),urls=[];
 for(const m of String(html).matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
  let u;
  try{u=new URL(m[1],base);}catch{continue;}
  if(u.hostname!==host||!/^\/fishing\/\d+\.html$/.test(u.pathname))continue;
  u.hash='';u.search='';
  if(seen.has(u.href))continue;seen.add(u.href);urls.push(u.href);
  if(urls.length>=limit)break;
 }
 return urls;
}
function parseFishingPointDetail(html,url,source){
 // Each confirmed record must come from one concrete detail page, not a search snippet.
 if(!/<h[1-5][^>]*>\s*アオリイカ\s*<\/h[1-5]>/i.test(html))return null;
 if(!/<h[1-5][^>]*>\s*エギング\s*<\/h[1-5]>/i.test(html))return null;
 const plain=strip(html);
 const end=plain.indexOf('その他の福井の釣果情報');
 const details=plain.slice(0,end>=0?end:1200);
 const d=details.match(/日時\s*(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
 const pm=details.match(/場所\s*(.{1,80}?)\s*(?:サイズ|重さ|仕掛orヒットルアー)/);
 if(!d||!pm)return null;
 const date=d[1]+'-'+d[2].padStart(2,'0')+'-'+d[3].padStart(2,'0');
 const place=pm[1].trim();
 // A precise coastal location + shore technique is mandatory. Offshore and other regions excluded.
 if(!/越前海岸/.test(place)||/沖|船|ボート|筏|いかだ/.test(place))return null;
 const dateTime=details.match(/日時\s*20\d{2}\/\d{1,2}\/\d{1,2}\s*\/\s*([^\s]{1,24})/);
 const size=(details.match(/サイズ\s*(.{1,55}?)\s*重さ/)||[])[1]||null;
 const id='fishingpoint-'+crypto.createHash('sha1').update(url).digest('hex').slice(0,16);
 return {
  id,date,time:dateTime?.[1]||null,region:'越前',subregion:'越前海岸',mode:'shore',method:'エギング',
  place_type:'越前海岸（場所は地域精度）',catch_count:null,confirmed_events:null,
  claimed_count:null,count_source:'report_only',count_basis:'unknown',duration_hours:null,cpue:null,
  size_text:size,max_size_text:size,angler:null,confidence:'釣具店公開・日付/釣法確認',
  source:source.name,source_url:url,notes:'独立した実釣投稿。杯数の明示がないため推定しません。',
  verified:true,location_precision:'area'
 };
}
async function collectFishingPoint(source,fetchText,now=new Date()){
 const index=await fetchText(source.url);
 const urls=detailLinks(index,source.url,12);
 if(!urls.length)throw Error('Fishing Point list has no detail links (layout changed or blocked)');
 const t=Date.parse(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)+'T00:00:00+09:00');
 const rows=[],errors=[];
 for(const url of urls){
  try{
   const row=parseFishingPointDetail(await fetchText(url),url,source);
   if(!row)continue;
   const age=Math.round((t-Date.parse(row.date+'T00:00:00+09:00'))/DAY);
   if(age>=0 && age<30)rows.push(row);
  }catch(e){errors.push(String(e).slice(0,140));}
 }
 if(!rows.length&&errors.length===urls.length)throw Error('All Fishing Point detail fetches failed');
 return {rows:[...new Map(rows.map(x=>[x.id,x])).values()],errors,detail_links:urls.length};
}
module.exports={strip,detailLinks,parseFishingPointDetail,collectFishingPoint};
