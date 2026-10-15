const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const {createPlan,shoreCoverage,seasonalTerms}=require('../scripts/query-plan');
const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/search-config.json'),'utf8'));
const sampleDate=new Date('2026-10-16T00:00:00Z');

test('every rotation covers all eight areas, even with 12 searches',()=>{
 const required=cfg.regions.map(r=>r.region).sort();
 for(const round of [0,1,2,3,4,5,12,100]){
   const a=createPlan(cfg,round,12,{},sampleDate);
   assert.equal(a.length,12);
   assert.deepEqual([...new Set(a.map(x=>x.region).filter(Boolean))].sort(),required);
   assert.equal(new Set(a.map(x=>x.query)).size,12);
 }
});
test('the next run uses different keyword combinations',()=>{
 const a=createPlan(cfg,0,12,{},sampleDate).map(x=>x.query);
 const b=createPlan(cfg,1,12,{},sampleDate).map(x=>x.query);
 assert.ok(a.filter(x=>b.includes(x)).length<4);
});
test('place names and techniques rotate around Tsunekami',()=>{
 const p=Array.from({length:8},(_,round)=>
  createPlan(cfg,round,12,{},sampleDate).find(x=>x.region==='常神半島').query);
 assert.ok(new Set(p).size>=6);
 assert.ok(p.some(x=>x.includes('小川漁港')));
 assert.ok(p.some(x=>x.includes('神子')));
 assert.ok(p.every(x=>x.includes('常神半島')));
});
test('extra slots prioritize the regions with fewer recent shore reports',()=>{
 const low={...Object.fromEntries(cfg.regions.map(r=>[r.region,100])),
  '常神半島':0,'高浜':0,'舞鶴':0,'越前':0};
 const plan=createPlan(cfg,0,12,low,sampleDate);
 assert.deepEqual(plan.filter(x=>x.family.startsWith('site-')).map(x=>x.region).sort(),
  ['常神半島','舞鶴','越前','高浜'].sort());
});
test('recent coverage excludes boats, old data and future records',()=>{
 const data=[
 {region:'常神半島',mode:'shore',date:'2026-10-15'},
 {region:'常神半島',mode:'boat',date:'2026-10-15'},
 {region:'舞鶴',mode:'shore',date:'2026-10-01'},
 {region:'小浜湾',mode:'shore',date:'2026-10-16'},
 {region:'敦賀',mode:'shore',date:'2026-10-20'}
 ];
 assert.deepEqual(shoreCoverage(data,sampleDate),{'常神半島':1,'小浜湾':1});
});
test('vocabulary changes with spring and autumn',()=>{
 assert.ok(seasonalTerms(10).includes('新子'));
 assert.ok(seasonalTerms(4).includes('春イカ'));
 assert.ok(seasonalTerms(1).includes('ティップラン'));
});
