const test=require('node:test');
const assert=require('node:assert/strict');
const {parseJohshuya}=require('../scripts/collect');
const source={id:'johshuya-shinfukui',name:'上州屋 新福井店',shop_label:'新福井店',region:'越前',url:'https://www.johshuya.co.jp/shop/choka.php?s=60'};
test('new store contributes a verified independent shore session',()=>{
 const html='<div>新福井店（福井県）：2026年10月23日の釣果 アオリイカ | 10 - 21 cm | 合計 2 匹 釣り場 | 越前海岸 釣り人 | お客様M様 エギングで2ハイ</div>';
 const rows=parseJohshuya(html,source);
 assert.equal(rows.length,1);
 assert.equal(rows[0].mode,'shore');
 assert.equal(rows[0].region,'越前');
 assert.equal(rows[0].catch_count,2);
 assert.equal(rows[0].source,'上州屋 新福井店');
});
test('another prefecture is never re-labeled as Echizen',()=>{
 const html='<div>新福井店（福井県）：2026年09月23日の釣果 アオリイカ | 10 - 15 cm | 合計 17 匹 釣り場 | 金沢沖 釣り人 | スタッフ中村 ティップラン</div>';
 assert.equal(parseJohshuya(html,source).length,0);
});
test('other shop reports on same HTML are excluded from Shinfukui feed',()=>{
 const html='<div>新敦賀店（福井県）：2026年10月23日の釣果 アオリイカ | 10 - 15 cm | 合計 2 匹 釣り場 | 敦賀の堤防 釣り人 | A エギング</div>';
 assert.equal(parseJohshuya(html,source).length,0);
});