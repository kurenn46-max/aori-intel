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


test('上州屋の公開釣果から地域・杯数・サイズを抽出する',()=>{
  const h='<div>新敦賀店（福井県）：2026年09月24日の釣果 晴れ アオリイカ | 12 - 18 cm | 合計 2 匹 釣り場 | 敦賀の堤防 釣り人 | テスト氏 エギングで2杯キャッチ。</div>';
  const rows=c.parseJohshuya(h,{id:'j',name:'上州屋 新敦賀店',url:'https://johshuya.co.jp/shop/choka.php?s=151',region:'敦賀'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].region,'敦賀');
  assert.equal(rows[0].catch_count,2);
  assert.equal(rows[0].mode,'shore');
  assert.equal(rows[0].size_text,'12〜18cm');
});

test('船の1人あたりレンジを船中総数に変換しない',()=>{
  const h='<div>釣行日：2026年10月6日(火) アオリイカ 3 - 15 匹 釣り場 小浜沖 コメント ティップランで狙いました。</div>';
  const rows=c.parseChowari(h,{id:'boat',name:'かどや丸 釣果',url:'https://example.com',region:'小浜湾'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].catch_min,3);
  assert.equal(rows[0].catch_max,15);
  assert.equal(rows[0].count_basis,'per_angler_range');
  assert.equal(rows[0].mode,'boat');
});

test('魚速索引は岸と船を別レコードとして扱える',()=>{
  const h='<div>昨日の釣果 エギング アオリイカ 2杯 2026-10-07推定都道府県:福井県 市区町村:敦賀市 関連ポイント:敦賀 関連魚種: アオリイカ 釣り方:エギング 推定フィールド:ソルト陸っぱり 情報元:公開SNS 2Click 10/4敦賀沖ボートエギング アオリイカ 5杯 2026-10-05推定都道府県:福井県 市区町村:敦賀市 関連ポイント:敦賀 関連魚種: アオリイカ 釣り方:ティップラン 推定フィールド:ソルトオフショア 情報元:公開SNS 1Click</div>';
  const rows=c.parseUosoku(h,{id:'u',name:'魚速',url:'https://example.com',region:'敦賀'});
  assert.equal(rows.length,2);
  assert.ok(rows.some(x=>x.mode==='shore'));
  assert.ok(rows.some(x=>x.mode==='boat'));
});
