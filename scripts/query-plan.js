'use strict';
// Deterministic per-run rotation. Each run covers every region; extra slots go to
// regions with the fewest recent shore reports. Never mistake search misses for
// absence of squid.
const families=[
  {id:'generic',text:'アオリイカ 釣果'},
  {id:'shore',text:'エギング アオリイカ'},
  {id:'recent',text:'アオリイカ 釣れた'},
  {id:'boat',text:'ティップラン アオリイカ 釣果'},
  {id:'shore-seasonal',text:'秋イカ エギング'},
  {id:'boat-report',text:'遊漁船 アオリイカ'},
  {id:'shoal',text:'新子 アオリイカ'},
  {id:'shore-report',text:'アオリイカ 陸っぱり'}
];
function jstYearMonth(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric'})
  .formatToParts(date);
 const get=t=>Number(parts.find(x=>x.type===t)?.value);
 return {year:get('year'),month:get('month')};
}
function seasonalTerms(month){
 if(month>=3 && month<=6)return ['春イカ','親イカ','大型アオリ','藻場'];
 if(month>=8 && month<=11)return ['秋イカ','新子','エギング','朝まずめ'];
 return ['アオリイカ','ティップラン','エギング','深場'];
}
function createPlan(config,round=0,limit=12,shoreCounts={},date=new Date()){
 const safeRound=Math.max(0,Math.floor(Number(round)||0));
 const {year,month}=jstYearMonth(date);
 const regions=config.regions||[];
 const chosen=[],seen=new Set();
 const add=(query,region,family)=>{
   const text=query.trim().replace(/\s+/g,' ');
   if(!text||seen.has(text)||chosen.length>=limit)return;
   seen.add(text);chosen.push({query:text,region,family});
 };
 // 1 guaranteed query from each area, rotated terms & semantic patterns.
 regions.forEach((r,i)=>{
   const loc=r.terms[(safeRound+i*2)%r.terms.length];
   const wording=families[(safeRound+i)%families.length];
   const phrase=wording.id==='shore-seasonal'?seasonalTerms(month)[0]+' エギング':wording.text;
   add('"'+loc+'" '+r.region+' '+phrase+' '+year+' '+month,r.region,wording.id);
 });
 // 2 extra queries prioritize observed blind spots without claiming low catch rate.
 const scarcity=regions.map((r,i)=>({...r,i,n:Number(shoreCounts[r.region])||0}))
 .sort((a,b)=>a.n-b.n||((a.i+safeRound)%regions.length)-((b.i+safeRound)%regions.length));
 const extraLimit=Math.min(4,limit-chosen.length);
 for(let k=0;k<extraLimit;k++){
   const r=scarcity[k%scarcity.length];
   const loc=r.terms[(safeRound+k+1)%r.terms.length];
   const season=seasonalTerms(month)[(safeRound+k)%4];
   const family=k%2?'site-blog':'site-anglers';
   const site=k%2?'site:johshuya.co.jp':'site:anglers.jp';
   add(site+' "'+loc+'" '+r.region+' アオリイカ '+season+' '+year,r.region,family);
 }
 // 3 optional broad provider search: vary which platform/area is attempted.
 if(limit>chosen.length){
   const targeted=config.targeted_queries||[];
   for(let k=0;k<targeted.length && chosen.length<limit;k++){
     const q=targeted[(safeRound*5+k)%targeted.length];
     add(q+' '+year,null,'targeted');
   }
 }
 return chosen;
}
function shoreCoverage(catches,date=new Date()){
 const t=new Date(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)+'T00:00:00+09:00').getTime();
 const counts={};
 for(const x of catches||[]){
   if(x.mode!=='shore'||!x.region||!/^\d{4}-\d{2}-\d{2}$/.test(x.date||''))continue;
   const day=new Date(x.date+'T00:00:00+09:00').getTime();
   if(day<=t && t-day<7*86400000) counts[x.region]=(counts[x.region]||0)+1;
 }
 return counts;
}
module.exports={createPlan,shoreCoverage,seasonalTerms};
