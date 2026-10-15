const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
function harness(){
  const elements={
    '#netCount':{textContent:''},
    '#netRecords':{innerHTML:''}
  };
  const document={
    querySelector(selector){return elements[selector] || (elements[selector]={textContent:'',innerHTML:''});},
    addEventListener(){}
  };
  const app=vm.runInNewContext('(function(){'+appSource+'\nreturn {state,renderNetEvidence,summaryCards,analysis};})()', {document,fetch:async()=>null});
  return {elements,app};
}

test('the primary fishing mode selector includes shore and boat, never setnet',()=>{
  const match=html.match(/<div class="seg" id="modeTabs"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(match);
  assert.match(match[1],/data-mode="shore"/);
  assert.match(match[1],/data-mode="boat"/);
  assert.doesNotMatch(match[1],/data-mode="setnet"/);
  assert.match(html,/<details id="netDetails"/);
});
test('setnet panel only contains confirmed aori ingress records, without bait',()=>{
  const {app,elements}=harness();
  app.state.setnet=[
   {date:'2026-10-03',gear_attribution:'confirmed',aori_present:true,fishery:'宇久定置網',source:'現地記事',source_url:'https://example.com/genuine',species:[{name:'アオリイカ'},{name:'ジンタ'},{name:'サゴシ'}]},
   {date:'2026-10-04',gear_attribution:'mixed_or_general',aori_present:true,fishery:'混合集荷'},
   {date:'2026-10-05',gear_attribution:'confirmed',aori_present:false,fishery:'シイラのみ'}
  ];
  app.renderNetEvidence();
  assert.equal(elements['#netCount'].textContent,'1件');
  const markup=elements['#netRecords'].innerHTML;
  assert.match(markup,/宇久定置網/);
  assert.match(markup,/アオリ入網確認（数量不明）/);
  assert.doesNotMatch(markup,/ジンタ|サゴシ|シイラ|混合集荷/);
  assert.match(markup,/https:\/\/example.com\/genuine/);
});
test('when no aori setnet evidence exists, never claim squid was absent',()=>{
 const {app,elements}=harness();
 app.state.setnet=[{date:'2026-10-15',aori_present:false,gear_attribution:'mixed_or_general'}];
 app.renderNetEvidence();
 assert.equal(elements['#netCount'].textContent,'0件');
 assert.match(elements['#netRecords'].innerHTML,/未確認は「入網なし」を意味しません/);
});
test('shore summaries prioritize actual catch dates rather than unreliable CPUE',()=>{
 const {app}=harness();
 app.state.mode='shore';
 const cards=app.summaryCards([
  {date:'2026-10-13',mode:'shore',verified:true,catch_count:3,cpue:60},
  {date:'2026-10-14',mode:'shore',verified:true,catch_count:1},
  {date:'2026-10-15',mode:'shore',verified:false,catch_count:99}
 ]);
 assert.equal(cards.length,4);
 assert.equal(cards[0][1],2);
 assert.equal(cards[1][1],'3杯');
 assert.equal(cards[2][1],1);
 assert.equal(cards[3][1],'2026/10/14');
 assert.ok(cards.every(c=>!String(c[0]).includes('CPUE')));
});
test('unverified-only catches are reported as insufficient evidence',()=>{
 const {app}=harness();
 app.state.mode='shore';
 const result=app.analysis([{date:'2026-10-15',catch_count:45,verified:false}]);
 assert.equal(result[0],'材料不足');
});
