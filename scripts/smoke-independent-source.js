'use strict';
const fs=require('node:fs');
const {parseJohshuya}=require('./collect');
const registry=JSON.parse(fs.readFileSync('data/source-registry.json','utf8'));
const source=registry.sources.find(x=>x.id==='johshuya-shinfukui');
if(!source||!source.enabled)throw new Error('Independent source is not enabled');
(async()=>{
 const ctl=new AbortController();
 const timeout=setTimeout(()=>ctl.abort(),15000);
 try{
  const response=await fetch(source.url,{
   headers:{'user-agent':'Mozilla/5.0 AORI-INTEL source verification (+GitHub Actions)'},
   signal:ctl.signal
  });
  if(!response.ok)throw new Error('shop responded HTTP '+response.status);
  const html=await response.text();
  const rows=parseJohshuya(html,source);
  const shore=rows.filter(x=>x.mode==='shore'&&x.region==='越前'&&x.verified===true);
  const report={source:source.name,url:source.url,http:response.status,
   parsed:rows.length,verified_shore:shore.length,
   latest:shore.map(x=>x.date).sort().at(-1)||null};
  console.log('INDEPENDENT_SOURCE_SMOKE',JSON.stringify(report));
  if(!shore.length)throw new Error('No confirmed Echizen shore catch parsed; do not claim coverage growth');
 }finally{clearTimeout(timeout);}
})().catch(e=>{console.error('INDEPENDENT_SOURCE_SMOKE_FAILED',String(e));process.exitCode=1;});
