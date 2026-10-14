const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const html=fs.readFileSync('worker-access-admin.html');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'chromium',...(process.env.WORKER_CHROMIUM_PATH?{executablePath:process.env.WORKER_CHROMIUM_PATH}:{})});
  async function pageFor(admin=true,fail=false){
   const page=await browser.newPage();
   await page.addInitScript(({admin,fail})=>{
    window.__calls=[];let signedIn=true;
    const rows={fire_events:[{id:'event1',event_number:100001,name:'TEST',status:'active'}],workers:[{id:'11111111-1111-4111-8111-111111111111',name:'Same Name',status:'בדרך'},{id:'22222222-2222-4222-8222-222222222222',name:'Same Name',status:'הגיע'}]};
    window.supabase={createClient(){return {
     auth:{async getSession(){return {data:{session:signedIn?{}:null}}},async signOut(){signedIn=false;return {error:null}}},
     async rpc(name,args){window.__calls.push({name,args});return {data:name==='is_admin'?admin:'message-id',error:name==='admin_send_secure_worker_message'&&fail?{message:'Rejected'}:null}},
     from(table){window.__calls.push({table});const q={select(){return q},eq(){return q},neq(){return q},order(){return q},then(resolve,reject){return Promise.resolve({data:rows[table]||[],error:null}).then(resolve,reject)}};return q}
    }}};
   },{admin,fail});
   await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:''}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/worker-access-admin.html');return page;
  }
  let p=await pageFor(false);await p.waitForFunction(()=>document.querySelector('#err').textContent.includes('מנהלים'));assert(await p.isHidden('#panel'));assert(!(await p.evaluate(()=>window.__calls)).some(x=>x.table==='workers'));await p.close();console.log('PASS Non-admin cannot inspect workers or use message panel');
  p=await pageFor();await p.waitForFunction(()=>document.querySelector('#workers').options.length===2);const labels=await p.locator('#workers option').allTextContents();assert.notEqual(labels[0],labels[1]);await p.selectOption('#workers','22222222-2222-4222-8222-222222222222');await p.fill('#message','Message for second worker');await p.click('#sendMessage');await p.waitForFunction(()=>document.querySelector('#err').textContent.startsWith('✓'));const call=(await p.evaluate(()=>window.__calls)).find(x=>x.name==='admin_send_secure_worker_message');assert.equal(call.args.p_worker_id,'22222222-2222-4222-8222-222222222222');assert.equal(call.args.p_message,'Message for second worker');await p.close();console.log('PASS Duplicate names are distinguished and message uses exact worker ID');
  p=await pageFor(true,true);await p.waitForFunction(()=>document.querySelector('#workers').options.length===2);await p.fill('#message','Rejected message');await p.click('#sendMessage');await p.waitForFunction(()=>document.querySelector('#err').textContent==='Rejected');assert.equal(await p.inputValue('#message'),'Rejected message');await p.close();console.log('PASS Rejected manager message remains visible and does not show success');
  console.log('3 admin browser tests passed.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
