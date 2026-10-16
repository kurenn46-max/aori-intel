const urls=[
'https://fishing.ne.jp/fishingpost/area/kyoto?fish=fish-aoriika',
'https://tsurirepo.com/boats/fukui_kaiseimaru/',
'https://tsurirepo.com/boats/kyoto_miyamotomaru/'];
(async()=>{
 for(const url of urls){
 try{
 const r=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{'user-agent':'Mozilla/5.0 (compatible; AORI-INTEL/2.4; diagnostic)'}});
 const html=await r.text();
 const text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 const dates=[...text.matchAll(/2026(?:年|\/)10(?:月|\/)\d{1,2}/g)].slice(0,7).map(m=>text.slice(Math.max(0,m.index-70),m.index+240));
 const anchors=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].filter(x=>/アオリイカ|エギング|10\/|10月|釣果/.test(x[2].replace(/<[^>]+>/g,' '))).slice(0,10).map(x=>({href:x[1],txt:x[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,100)}));
 console.log('PROBE',JSON.stringify({url,status:r.status,bytes:html.length,anchors,dates,bodySample:text.slice(Math.max(0,text.indexOf('釣果履歴')-80),Math.max(0,text.indexOf('釣果履歴')-80)+1100),anchorCount:(html.match(/<a\b/gi)||[]).length}).slice(0,4200));
 }catch(e){console.log('PROBE_FAIL',url,String(e).slice(0,200));}
 }
})()
