'use strict';
async function fetchPage(url){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),12000);try{
 const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 AORI-INTEL validation (+GitHub Actions)'},signal:ctrl.signal});
 if(!r.ok)throw Error('HTTP '+r.status);
 return await r.text();}finally{clearTimeout(t)}}
(async()=>{
 const html=await fetchPage('https://fishing-point.jp/fishing_cat/aori_squid/');
 const hrefs=[...html.matchAll(/href\s*=\s*["']([^"']*\/fishing\/\d+\.html)["']/gi)].map(x=>x[1]);
 const uniq=[...new Set(hrefs)].slice(0,3);
 console.log('FISHINGPOINT_INDEX_PROBE',JSON.stringify({length:html.length,links:hrefs.length,sample:uniq}));
 if(!uniq.length)throw Error('No detail links found');
 const url=new URL(uniq[0],'https://fishing-point.jp').toString();
 const detail=await fetchPage(url);
 const strip=s=>s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 const txt=strip(detail);
 for(const key of ['釣人','日時','場所','サイズ','仕掛orヒットルアー']){
  const i=txt.indexOf(key);
  console.log('FISHINGPOINT_DETAIL_PROBE',key, i, i>=0?txt.slice(Math.max(0,i-60),i+220):'not found');
 }
 console.log('FISHINGPOINT_TAG_PROBE',JSON.stringify({h3Eging:/<h[1-5][^>]*>\s*エギング\s*<\/h[1-5]>/i.test(detail),hAori:/<h[1-5][^>]*>\s*アオリイカ\s*<\/h[1-5]>/i.test(detail)}));
})().catch(e=>{console.error('FISHINGPOINT_PROBE_FAILED',String(e));process.exitCode=1;});
