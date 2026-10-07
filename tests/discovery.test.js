const test=require('node:test');
const assert=require('node:assert/strict');
const d=require('../scripts/discover');

test('検索語を地域横断で十分生成する',()=>{
  const q=d.queryList();
  assert.ok(q.length>=20);
  assert.ok(q.some(x=>x.includes('常神')));
  assert.ok(q.some(x=>x.includes('敦賀')));
  assert.ok(q.some(x=>x.includes('site:anglers.jp')));
});

test('Bing RSSを候補に変換できる',()=>{
  const xml=`<rss><channel><item><title>常神でアオリイカ5杯</title><link>https://example.com/a</link><description>2026/10/07 常神 エギング アオリイカ5杯</description><pubDate>Wed, 07 Oct 2026 00:00:00 GMT</pubDate></item></channel></rss>`;
  const r=d.parseRss(xml,'常神 アオリイカ');
  assert.equal(r.length,1);
  assert.equal(r[0].url,'https://example.com/a');
});

test('地域・釣法・杯数・実釣日を抽出する',()=>{
  const page='2026/10/07 常神半島の漁港でエギング。アオリイカを5杯釣りました。胴長18cm。';
  const c=d.candidateFrom({query:'常神 アオリイカ',title:'釣果',description:'',url:'https://anglers.jp/test',pubDate:null},page);
  assert.equal(c.region,'常神半島');
  assert.equal(c.mode,'shore');
  assert.equal(c.count,5);
  assert.equal(c.date,'2026-10-07');
  assert.equal(c.status,'accepted');
});

test('船中釣果を1人釣果にしない',()=>{
  const x=d.countInfo('2026/10/07 敦賀のティップランでアオリイカ、船中42杯。');
  assert.equal(x.count,42);
  assert.equal(x.basis,'boat_total');
});
