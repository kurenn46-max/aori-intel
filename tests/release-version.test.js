const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'..');
test('release version and mobile assets agree',()=>{
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const version=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).version;
 assert.match(html,new RegExp('AORI INTEL · V'+version.replaceAll('.','\\.')));
 for(const file of ['styles.css','source-balance.js','app.js']){
  assert.ok(html.includes(file+'?v='+version),'cache-busted '+file);
 }
 assert.ok(html.includes('id="balancePanel"'));
});
