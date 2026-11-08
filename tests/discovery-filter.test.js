const test=require('node:test');
const assert=require('node:assert/strict');
const {relevantSearchHit,candidateFrom}=require('../scripts/discover');
test('a geo-targeted search can discover articles with location omitted in snippet',()=>{
 const item={query:'小浜湾 アオリイカ 釣果 2026',title:'アオリイカ実釣レポート',description:'秋のエギング釣果',url:'https://example.com/posts/2026'};
 assert.equal(relevantSearchHit(item),true);
 const parsed=candidateFrom(item,'');
 assert.equal(parsed.region_confirmed,false);
 assert.equal(parsed.status,'candidate');
});
test('a generic unrelated title never enters the candidate queue',()=>{
 const item={query:'小浜湾 アオリイカ',title:'通販 セール情報',description:'おすすめ商品',url:'https://example.com'};
 assert.equal(relevantSearchHit(item),false);
});
test('no location in text or search cannot enter the geo queue',()=>{
 const item={query:'海釣り',title:'アオリイカ釣れた',description:'今日の釣果',url:'https://example.com'};
 assert.equal(relevantSearchHit(item),false);
});