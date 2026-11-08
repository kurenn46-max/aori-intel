const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../source-balance');
const now='2026-11-08';
const egi={source:'エギCOM 小浜',mode:'shore',date:'2026-11-07',region:'小浜湾',verified:true};
const shop={source:'上州屋 新敦賀店',mode:'shore',date:'2026-11-06',region:'敦賀',verified:true};

test('counts unique published shore sessions by independent publisher, not boat or unknown',()=>{
 const result=summarize([egi,egi,shop,{...shop,mode:'boat'}, {...shop,verified:false},
   {...shop,date:'2026-10-20'}, {...shop,date:'2026-11-09'}],{today:now});
 assert.equal(result.total,3);
 assert.equal(result.egicom,2);
 assert.equal(result.independent,1);
 assert.equal(result.share,67);
 assert.deepEqual(result.independentSources,['上州屋 新敦賀店']);
});
test('no records means no coverage, not zero catches or a fabricated probability',()=>{
 const x=summarize([{...egi,date:'2026-10-01'}],{today:now});
 assert.equal(x.total,0); assert.equal(x.share,null); assert.equal(x.status,'no_data');
});
test('filters by chosen area while reporting shore independently of display mode',()=>{
 const s=summarize([egi,shop,{...shop,subregion:'小浜',region:'敦賀'}],{today:now,region:'小浜湾'});
 assert.equal(s.total,1);
 assert.equal(s.independent,0);
 assert.equal(s.status,'concentrated');
});
test('reliance warning triggers for 80 percent or more single-network reports',()=>{
 const x=summarize([egi,egi,egi,egi,shop],{today:now});
 assert.equal(x.share,80);assert.equal(x.status,'concentrated');
});