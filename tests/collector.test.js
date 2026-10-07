const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const c=require('../scripts/collect.js');

const html=fs.readFileSync(path.join(__dirname,'fixtures/yamaria.html'),'utf8');

test('青りを検索語・地域判定に使わず、小名浜を小浜に誤分類しない',()=>{
  assert.equal(c.normalizeRegion('福島 小名浜'),null);
  assert.equal(c.normalizeRegion('福井 小浜'),'小浜湾');
  assert.equal(c.normalizeRegion('小川漁港付近'),'常神半島');
});

test('YAMARIAのHIT数を杯数として扱わない',()=>{
  const events=c.parseYamaria(html,{name:'fixture',url:'https://example.com',region:'小浜湾'});
  assert.equal(events.length,5);
  assert.ok(events.every(x=>x.catch_count===1));
  assert.equal(events[0].raw_hit,35);
});

test('岸と船を分離する',()=>{
  const events=c.parseYamaria(html,{name:'fixture',url:'https://example.com',region:'小浜湾'});
  assert.equal(events.filter(x=>x.mode==='boat').length,1);
  assert.equal(events.filter(x=>x.mode==='shore').length,4);
});

test('同一人物・同日・近接投稿を1釣行に統合する',()=>{
  const events=c.parseYamaria(html,{name:'fixture',url:'https://example.com',region:'小浜湾'});
  const sessions=c.groupSessions(events);
  const yuu=sessions.find(x=>x.angler==='yuu');
  const mak=sessions.find(x=>x.angler==='まこっち');
  assert.equal(yuu.catch_count,2);
  assert.equal(yuu.confirmed_events,2);
  assert.equal(mak.catch_count,2);
  assert.equal(mak.mode,'shore');
});

test('定置網だけの入荷記事はアオリとベイトを抽出する',()=>{
  const h=fs.readFileSync(path.join(__dirname,'fixtures/wakasa.html'),'utf8');
  const row=c.parseWakasaArticle(h,'https://seiza-design.com/blog/archives/26945',{name:'fixture'});
  assert.equal(row.gear_attribution,'confirmed');
  assert.equal(row.aori_present,true);
  assert.ok(row.species.some(x=>x.name==='ジンタ'&&x.signal==='direct_bait'));
  assert.ok(row.species.some(x=>x.name==='サゴシ'&&x.signal==='indirect_predator_signal'));
});
