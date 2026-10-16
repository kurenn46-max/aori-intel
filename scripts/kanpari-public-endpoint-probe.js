// Test only documented/public endpoints; no access-control bypass.
const urls=[
"https://fishing.ne.jp/fishingpost/area/kyoto?fish=fish-aoriika",
"https://fishing.ne.jp/feed",
"https://fishing.ne.jp/fishingpost/area/kyoto/feed?fish=fish-aoriika",
"https://fishing.ne.jp/sitemap.html",
"https://fishing.ne.jp/fishingpost-sitemap.html",
"https://fishing.ne.jp/wp-json/wp/v2/"
];
for(const url of urls){
 try{
  const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{"User-Agent":"AORI-INTEL/2.4 (public-source-probe)"}});
  const body=await r.text();
  const type=r.headers.get('content-type');
  const countLinks=(body.match(/<loc>/gi)||[]).length;
  const recent=(body.match(/2026[-/.]10[-/.]\d\d/g)||[]).slice(0,4);
  console.log('KANPARI_PUBLIC_ENDPOINT',JSON.stringify({url,status:r.status,type,bytes:body.length,countLinks,recent,title:(body.match(/<title>([^<]{0,120})<\/title>/i)||[])[1]||'',blocked:/just a moment|enable javascript and cookies|access denied|captcha/i.test(body)}));
 }catch(e){console.log('KANPARI_PUBLIC_ENDPOINT_ERROR',url,String(e).slice(0,180));}
}
