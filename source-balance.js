/* AORI INTEL: evidence coverage is not a catch probability.
 * Shared by browser UI and Node tests. Every record is one reported session.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.AoriSourceBalance=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const DAY=24*60*60*1000;
  function summarize(rows, options={}){
    const today=options.today;
    const region=options.region||'全地域';
    const days=options.days||7;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(today||''))throw new Error('today must be YYYY-MM-DD');
    const base=Date.parse(today+'T00:00:00+09:00');
    let total=0,egicom=0,independent=0;
    const otherSources=new Set(),allSources=new Set();
    for(const x of rows||[]){
      if(!x||x.mode!=='shore'||x.verified===false||!/^\d{4}-\d{2}-\d{2}$/.test(x.date||''))continue;
      const when=Date.parse(x.date+'T00:00:00+09:00');
      const age=Math.round((base-when)/DAY);
      if(!Number.isFinite(age)||age<0||age>=days)continue;
      if(region!=='全地域'&&!String(x.region||'').includes(region)&&!String(x.subregion||'').includes(region))continue;
      total++;
      const src=String(x.source||'出典不明');
      allSources.add(src);
      if(src.startsWith('エギCOM'))egicom++;
      else {independent++;otherSources.add(src);}
    }
    const share=total?Math.round(100*egicom/total):null;
    const status=total===0?'no_data':share>=80?'concentrated':independent>=3&&otherSources.size>=2?'diversified':'limited';
    return {total,egicom,independent,share,status,
      totalSources:allSources.size,independentSources:[...otherSources].sort(),
      days,region};
  }
  return {summarize};
});