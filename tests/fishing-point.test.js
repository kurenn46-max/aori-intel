const test=require('node:test');
const assert=require('node:assert/strict');
const {detailLinks,parseFishingPointDetail}=require('../scripts/fishing-point');
const src={name:'フィッシングポイント'};
const url='https://fishing-point.jp/fishing/31827.html';
const html='<h2>アオリイカ</h2><h3>エギング</h3><div>釣人 渡部さん 日時 2026/11/04 / PM10：00 場所 福井 越前海岸 サイズ 21.5㎝（胴長） 重さ － 仕掛orヒットルアー エギ王Ｋ3.5号</div><p>その他の福井の釣果情報</p>';
test('indexes only same-site detail articles, deduplicated',()=>{
 const listing='<a href="/fishing/31827.html">もっと見る</a><a href="'+url+'">more</a><a href="https://other.test/fishing/777.html">foreign</a><a href="/shop/">shop</a>';
 assert.deepEqual(detailLinks(listing,'https://fishing-point.jp/fishing_cat/aori_squid/'),[url]);
});
test('accepts independently verified coastal Eging as a report without invented squid count',()=>{
 const r=parseFishingPointDetail(html,url,src);
 assert.equal(r.mode,'shore');assert.equal(r.region,'越前');assert.equal(r.date,'2026-11-04');
 assert.equal(r.verified,true);assert.equal(r.catch_count,null);assert.equal(r.location_precision,'area');
});
test('boat or other-species fishing never becomes verified shore Aori',()=>{
 assert.equal(parseFishingPointDetail(html.replace('越前海岸','越前海岸沖'),url,src),null);
 assert.equal(parseFishingPointDetail(html.replace('<h2>アオリイカ</h2>','<h2>コウイカ</h2>'),url,src),null);
 assert.equal(parseFishingPointDetail(html.replace('<h3>エギング</h3>','<h3>ティップラン</h3>'),url,src),null);
});
test('missing actual trip date does not become a fresh catch',()=>{
 assert.equal(parseFishingPointDetail(html.replace('2026/11/04','日付不明'),url,src),null);
});