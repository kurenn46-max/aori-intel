'use strict';
const {collectFishingPoint}=require('./fishing-point');
const fs=require('node:fs');
const registry=JSON.parse(fs.readFileSync('data/source-registry.json','utf8'));
const source=registry.sources.find(x=>x.id==='fishingpoint-echizen');
async function fetchPage(url){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 AORI-INTEL validation (+GitHub Actions)'},signal:ctrl.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  return await r.text();
 }finally{clearTimeout(timer);}
}
(async()=>{
 const result=await collectFishingPoint(source,fetchPage);
 const summary={source:source.name,index:source.url,links_examined:result.detail_links,
  verified_shore:result.rows.length,errors:result.errors.length,
  dates:result.rows.map(x=>x.date).slice(0,8),unknown_counts:result.rows.filter(x=>x.catch_count==null).length,
  latest:result.rows.map(x=>x.date).sort().at(-1)||null};
 console.log('FISHINGPOINT_REAL_SMOKE',JSON.stringify(summary));
 if(!result.rows.length)throw Error('No verified onshore squid articles extracted');
 if(result.rows.some(x=>x.mode!=='shore'||x.verified!==true||x.catch_count!=null))
  throw Error('Source safety invariant violated');
})().catch(e=>{console.error('FISHINGPOINT_SMOKE_FAILED',String(e));process.exitCode=1;});
