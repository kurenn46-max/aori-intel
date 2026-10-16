const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('node:vm');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function fixture(fixtures={}){
  const elements={
    '#refreshBtn':{textContent:'更新確認',disabled:false},
    '#refreshNotice':{textContent:''},
    '#statusStrip':{textContent:''}
  };
  const document={
    addEventListener(){},
    querySelector(sel){return elements[sel]??(elements[sel]={textContent:'',innerHTML:''});},
    querySelectorAll(){return []}
  };
  const responses={...fixtures};
  async function fetch(url){
    const name=String(url).split('/').at(-1).split('?')[0];
    if(responses[name]==='FAIL')return {ok:false,status:503};
    return {ok:true,json:async()=>responses[name]};
  }
  // Render has its own UI tests; only test the refresh state transition here.
  const obj=vm.runInNewContext('(function(){'+app+'\nrender=()=>{};return {state,load,refreshMessage};})()', {document,fetch});
  return {obj,elements,responses};
}
const status={'checked_at':'2026-10-15T23:22:40.285Z',sources:[]};
const discovery={'checked_at':'2026-10-15T23:22:46.745Z',queries_ok:12};
test('UI explicitly distinguishes reread from genuine collection',()=>{
  assert.match(html,/id="refreshBtn"[^>]*>更新確認/);
  assert.match(html,/id="refreshNotice"/);
  assert.match(html,/actions\/workflows\/collect\.yml/);
  assert.match(html,/Run workflow/);
});
test('after a refresh with no newly published records, user gets nonmisleading feedback',async()=>{
  const f=fixture({'catches.json':[{id:'one',date:'2026-10-15'}],'setnet.json':[],
      'source-status.json':status,'discovery-status.json':discovery});
  await f.obj.load();
  assert.match(f.elements['#refreshNotice'].textContent,/保存済みの釣果1件/);
  await f.obj.load();
  assert.match(f.elements['#refreshNotice'].textContent,/保存データに新着なし/);
  assert.match(f.elements['#refreshNotice'].textContent,/このボタンは新たな収集を起動しません/);
  assert.equal(f.elements['#refreshBtn'].disabled,false);
  assert.equal(f.elements['#refreshBtn'].textContent,'更新確認');
});
test('detect only genuinely new record identifiers on reload',async()=>{
  const f=fixture({'catches.json':[{id:'one'}],'setnet.json':[],
   'source-status.json':status,'discovery-status.json':discovery});
  await f.obj.load();
  f.responses['catches.json']=[{id:'one'},{id:'two'},{id:'three'}];
  await f.obj.load();
  assert.match(f.elements['#refreshNotice'].textContent,/新着2件/);
});
test('failed network fetch never erases previously displayed catches',async()=>{
  const f=fixture({'catches.json':[{id:'original'}],'setnet.json':[],
   'source-status.json':status,'discovery-status.json':discovery});
  await f.obj.load();
  f.responses['catches.json']='FAIL';
  await f.obj.load();
  assert.equal(f.obj.state.catches.length,1);
  assert.equal(f.obj.state.catches[0].id,'original');
  assert.match(f.elements['#refreshNotice'].textContent,/取得失敗/);
  assert.equal(f.elements['#refreshBtn'].disabled,false);
});
