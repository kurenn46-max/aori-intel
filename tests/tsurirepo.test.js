const test=require('node:test');
const assert=require('node:assert/strict');
const {parseTsurirepo}=require('../scripts/collect');
const kaisei={id:'tsurirepo-kaiseimaru',name:'つりれぽ 海生丸（若狭大島）',url:'https://tsurirepo.com/boats/fukui_kaiseimaru/',region:'小浜湾',subregion:'若狭大島沖'};
const asOf=new Date('2026-10-16T00:00:00Z');

test('parse dated aori events, not fish count or overall vessel stats',()=>{
 const html='<h3>釣果履歴（208件／件）</h3><div>アオリイカ 32 コウイカ 9 この魚種を含む釣果履歴はありません。</div>'+
  '<h3>2026年10月14日（水）</h3><span>アオリイカ</span> <span>アオリイカ</span> <span>〜7匹</span>'+
  '<h3>2026年10月13日（火）</h3><span>ケンサキイカ</span> <span>〜31匹</span>'+
  '<h3>2026年10月12日（月）</h3><span>アオリイカ</span><span>アオリイカ</span>〜16匹'+
  '<h3>2026年10月11日（日）</h3><span>アオリイカ</span><span>アオリイカ</span>'+
  '<p>スポンサーリンク</p><h3>2026年10月10日</h3>アオリイカ 〜99匹';
 const rows=parseTsurirepo(html,kaisei,asOf);
 assert.deepEqual(rows.map(x=>x.date),['2026-10-14','2026-10-12','2026-10-11']);
 assert.equal(rows[0].catch_count,7);
 assert.equal(rows[1].catch_count,16);
 assert.equal(rows[2].catch_count,null);
 assert.ok(rows.every(x=>x.verified===false&&x.mode==='boat'));
 assert.ok(rows.every(x=>x.count_basis==='per_angler_max'||x.count_basis==='unknown'));
});
test('aori mentioned without its own number cannot inherit another species total',()=>{
 const html='釣果履歴（1件／件） 2026年10月15日（木） アオリイカ ケンサキイカ 〜55匹 スポンサーリンク';
 const r=parseTsurirepo(html,kaisei,asOf);
 assert.equal(r.length,1);
 assert.equal(r[0].catch_count,null);
});
test('repeated collection returns stable id for same vessel-date, no duplicates',()=>{
 const html='釣果履歴（1件／件） 2026年10月15日（木） アオリイカ アオリイカ 〜8匹 スポンサーリンク';
 const a=parseTsurirepo(html,kaisei,asOf);
 const b=parseTsurirepo(html,kaisei,asOf);
 assert.equal(a[0].id,b[0].id);
 assert.match(a[0].source_url,/#d-2026-10-15$/);
});
test('other ports do not become shore catches',()=>{
 const html='釣果履歴（1件／件） 2026年10月15日（木） アオリイカ アオリイカ 〜8匹 スポンサーリンク';
 const r=parseTsurirepo(html,{...kaisei,region:'舞鶴',subregion:'舞鶴沖'},asOf);
 assert.equal(r[0].region,'舞鶴');
 assert.equal(r[0].mode,'boat');
});
test('out of range history and summary header do not become catch reports',()=>{
 const html='アオリイカ 50 釣果履歴（2件／件） 2026年09月01日（火） アオリイカ 〜21匹 2026年10月16日（金） マイカ 〜15匹';
 assert.deepEqual(parseTsurirepo(html,kaisei,asOf),[]);
});
