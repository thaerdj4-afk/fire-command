const {chromium}=require('playwright');
const fs=require('node:fs');
const http=require('node:http');
const assert=require('node:assert/strict');
const html=fs.readFileSync('worker.html');
const eventId='11111111-1111-4111-8111-111111111111', workerId='22222222-2222-4222-8222-222222222222', token='a'.repeat(64);
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{browser=await chromium.launch({headless:true,channel:'chromium',timeout:20000,...(process.env.WORKER_CHROMIUM_PATH?{executablePath:process.env.WORKER_CHROMIUM_PATH}:{})})}catch(e){await new Promise(r=>server.close(r));throw e;}let passes=0;
 async function fixture(options={}){
  const page=await browser.newPage();const state={valid:true,locationOK:true,eventStatus:'active',workerStatus:'בדרך',inbox:[],calls:[],...options};
  await page.addInitScript(({eventId,workerId,token,saved,native,trusted})=>{
   if(trusted)localStorage.setItem('workerTrustedDeviceV1',JSON.stringify({id:workerId,token}));window.__ticks=[];window.setInterval=fn=>{window.__ticks.push(fn);return 1;};window.__watchCount=0;window.__clears=0;window.__nativeStarts=[];window.__nativeStops=0;
   Object.defineProperty(navigator,'geolocation',{value:{watchPosition(success,error){window.__gps=success;window.__gpsError=error;window.__watchCount++;return 1},clearWatch(){window.__clears++;window.__gps=null;}}});
   if(native)window.FireWorker={startSecureLocation(...args){window.__nativeStarts.push(args)},stopLocation(){window.__nativeStops++},locationMessage(){return 'waiting'}};
   if(saved){localStorage.setItem('workerSessionV13secure:'+eventId,JSON.stringify({name:'Test Worker',phone:'972500000000',id:workerId,token,sharing:true,finished:false}));localStorage.setItem('workerConsent:'+eventId,'yes');}
  },{eventId,workerId,token,saved:options.saved,native:options.native,trusted:options.trusted});
  await page.route('https://jvubjwzzikfwsektifzi.supabase.co/rest/v1/rpc/*',async route=>{
   const name=route.request().url().split('/').pop(),args=route.request().postDataJSON();state.calls.push({name,args});let data;
   switch(name){
    case 'worker_device_profile':data={id:workerId,name:'Test Worker',phone:'972524477147',status:state.trustStatus||'approved',fingerprint:'ABC12345',equipment:['בלי ציוד']};break;
    case 'worker_device_events':data=[{id:eventId,name:'TRUST EVENT',event_number:'100001',response:'pending'}];break;
    case 'worker_device_respond':data=true;break;
    case 'worker_device_join_event':data=state.trustDenied?null:{event_id:eventId,worker_id:workerId,session_token:token,expires_at:'2099-01-01T00:00:00Z'};break;
    case 'worker_start_secure_session':data=state.denied?[]:[{event_id:eventId,session_token:token,expires_at:'2099-01-01T00:00:00Z'}];break;
    case 'worker_event_state':data=[{name:'TEST EVENT',status:state.eventStatus}];break;
    case 'worker_secure_register':data=workerId;break;
    case 'worker_secure_session_worker_valid':data=state.valid;break;
    case 'worker_secure_profile':data=[{id:workerId,event_id:eventId,name:'Test Worker',status:state.workerStatus}];break;
    case 'worker_secure_inbox':data=state.inbox;break;
    case 'worker_secure_update_location':data=state.locationOK;break;
    case 'worker_secure_send_request':if(args.p_type==='SOS / סכנה'&&state.offlineSOS){await route.abort('internetdisconnected');return;}data=!(args.p_type==='SOS / סכנה'&&state.rejectSOS);break;
    default:data=true;
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/worker.html'+(options.saved?'?event='+eventId:''));
  await page.waitForFunction(()=>!document.querySelector('#join').disabled);
  async function join(consent=true){await page.fill('#name','Test Worker');await page.fill('#phone','٠٥٢٤٤٧٧١٤٧');await page.fill('#eventLink','100001');await page.fill('#eventSecret',options.code||'abcdefghijkl');await page.check('input[value="בלי ציוד"]');if(consent)await page.check('#consent');await page.click('#join');}
  async function tick(){await page.evaluate(async()=>{for(const fn of window.__ticks)await fn()});}
  async function gps(){await page.evaluate(async()=>{if(window.__gps)await window.__gps({coords:{latitude:33.2,longitude:35.7,accuracy:9}})});}
  return {page,state,errors,join,tick,gps};
 }
 async function test(name,fn){try{await fn();passes++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name,e);throw e;}}
 try{
  await test('First launch stays at entry and does not fetch event without authentication',async()=>{const f=await fixture();assert.equal(f.state.calls.length,0);assert(await f.page.isVisible('#entry'));await f.page.close()});
  await test('Consent is required before consuming access code',async()=>{const f=await fixture();await f.join(false);await f.page.waitForFunction(()=>document.querySelector('#entryError').textContent.length>0);assert.equal(f.state.calls.length,0);await f.page.close()});
  await test('Wrong access code cannot register or start GPS',async()=>{const f=await fixture({denied:true});await f.join();await f.page.waitForFunction(()=>document.querySelector('#entryError').textContent.length>0);assert(!f.state.calls.some(x=>x.name==='worker_secure_register'));assert.equal(await f.page.evaluate(()=>window.__watchCount),0);await f.page.close()});
  await test('Join normalizes phone, binds session and sends authenticated GPS',async()=>{const f=await fixture();await f.join();await f.page.waitForSelector('#inside',{state:'visible'});await f.gps();const r=f.state.calls.find(x=>x.name==='worker_secure_register');assert.equal(r.args.p_phone,'972524477147');const loc=f.state.calls.find(x=>x.name==='worker_secure_update_location');assert.equal(loc.args.p_worker_id,workerId);assert.equal(loc.args.p_session_token,token);assert.equal(loc.args.p_latitude,33.2);assert.equal(await f.page.inputValue('#eventSecret'),'');assert.deepEqual(f.errors,[]);await f.page.close()});
  await test('SOS reports success only after secure request succeeds',async()=>{const f=await fixture();await f.join();await f.page.waitForSelector('#inside',{state:'visible'});await f.gps();await f.page.click('#sos');await f.page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('SOS'));const call=f.state.calls.find(x=>x.args.p_type==='SOS / סכנה');assert.equal(call.args.p_worker_id,workerId);assert(call.args.p_details.startsWith('LOC|33.2|35.7|'));await f.page.close()});
  await test('Rejected SOS shows failure without claiming delivery',async()=>{const f=await fixture({rejectSOS:true});await f.join();await f.page.waitForSelector('#inside',{state:'visible'});await f.page.click('#sos');await f.page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('נכשלה'));assert(!(await f.page.textContent('#feedback')).includes('✓'));await f.page.close()});
  await test('Offline SOS shows failure and does not queue duplicate emergency',async()=>{const f=await fixture({offlineSOS:true});await f.join();await f.page.waitForSelector('#inside',{state:'visible'});await f.page.click('#sos');await f.page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('נכשלה'));await f.tick();assert.equal(f.state.calls.filter(x=>x.args.p_type==='SOS / סכנה').length,1);await f.page.close()});
  await test('HQ message is rendered as text and acknowledgment uses session',async()=>{const f=await fixture({saved:true,inbox:[{id:'msg1',request_type:'הודעה מהחפ״ק',details:'<img src=x onerror=alert(1)>',status:'חדש',created_at:'2026-10-13T12:00:00Z'}]});await f.page.waitForFunction(()=>document.querySelector('#hqText').textContent.includes('<img'));assert.equal(await f.page.locator('#hqText img').count(),0);await f.page.click('#ack');await f.page.waitForFunction(()=>document.querySelector('#ack').textContent==='✓ התקבל');assert(f.state.calls.some(x=>x.args.p_type==='אישור קבלת הודעה'&&x.args.p_session_token===token));await f.page.close()});
  await test('Revoked saved session stops GPS and returns to login',async()=>{const f=await fixture({saved:true,valid:false});await f.page.waitForFunction(()=>document.querySelector('#entryError').textContent.includes('פג תוקף'));assert.equal(await f.page.evaluate(()=>window.__watchCount),0);assert.equal(await f.page.evaluate(id=>localStorage.getItem('workerSessionV13secure:'+id),eventId),null);await f.page.close()});
  await test('Revocation while joined stops GPS and blocks additional session use',async()=>{const f=await fixture();await f.join();await f.page.waitForSelector('#inside',{state:'visible'});f.state.valid=false;await f.tick();assert(await f.page.isVisible('#entry'));assert((await f.page.evaluate(()=>window.__clears))>0);await f.page.close()});
  await test('Rejected GPS update stops watch',async()=>{const f=await fixture({locationOK:false});await f.join();await f.page.waitForSelector('#inside',{state:'visible'});await f.gps();assert((await f.page.evaluate(()=>window.__clears))>0);assert((await f.page.textContent('#gps')).includes('נדחה'));await f.page.close()});
  await test('HQ stop stops sharing and worker cannot override it',async()=>{const f=await fixture();await f.join();await f.page.waitForSelector('#inside',{state:'visible'});f.state.inbox=[{id:'stop',request_type:'הפסקת שיתוף מיקום',status:'פעיל',created_at:'2026-10-13T12:00:00Z'}];await f.tick();const watches=await f.page.evaluate(()=>window.__watchCount);await f.page.click('#toggleLocation');await f.page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('בקש מהחפ״ק'));assert.equal(await f.page.evaluate(()=>window.__watchCount),watches);await f.page.close()});
  await test('Event closure stops GPS and presents ended view',async()=>{const f=await fixture();await f.join();await f.page.waitForSelector('#inside',{state:'visible'});f.state.eventStatus='ended';await f.tick();assert(await f.page.isVisible('#ended'));assert((await f.page.evaluate(()=>window.__clears))>0);await f.page.close()});
  await test('Finish clears sharing and sends secure finish status',async()=>{const f=await fixture();await f.join();await f.page.waitForSelector('#inside',{state:'visible'});await f.page.click('#finish');await f.page.waitForSelector('#ended',{state:'visible'});assert(f.state.calls.some(x=>x.name==='worker_secure_set_status'&&x.args.p_status==='סיים'));assert((await f.page.evaluate(()=>window.__clears))>0);await f.page.close()});
  await test('Android secure bridge receives bound token and skips browser GPS',async()=>{const f=await fixture({native:true});await f.join();await f.page.waitForSelector('#inside',{state:'visible'});assert.deepEqual(await f.page.evaluate(()=>window.__nativeStarts[0]),[eventId,workerId,token]);assert.equal(await f.page.evaluate(()=>window.__watchCount),0);await f.page.close()});
  await test('Eight-digit numeric code reaches session RPC and enters worker view',async()=>{const f=await fixture({code:'12345678'});await f.join();await f.page.waitForSelector('#inside',{state:'visible'});assert.equal(f.state.calls.find(x=>x.name==='worker_start_secure_session').args.p_code,'12345678');await f.page.close()});
  await test('Approved identity opens home without GPS; joins active event without access code after consent',async()=>{const f=await fixture({trusted:true});await f.page.waitForSelector('#trustedHome',{state:'visible'});await f.page.waitForSelector('#trustedEvents button');assert.equal(await f.page.evaluate(()=>__watchCount),0);await f.page.locator('#trustedEvents button').first().click();assert(await f.page.isHidden('#eventSecretPanel'));await f.page.waitForFunction(()=>document.querySelector('#name').value==='Test Worker');assert.equal(await f.page.inputValue('#name'),'Test Worker');await f.page.check('#consent');await f.page.click('#join');await f.page.waitForSelector('#inside',{state:'visible'});assert(f.state.calls.some(x=>x.name==='worker_device_join_event'));assert(!f.state.calls.some(x=>x.name==='worker_start_secure_session'));assert.equal(await f.page.evaluate(()=>__watchCount),1);await f.page.close()});
  await test('Pending approved-worker request displays fingerprint and cannot list events or start GPS',async()=>{const f=await fixture({trusted:true,trustStatus:'pending'});await f.page.waitForFunction(()=>document.querySelector('#trustedStatus').textContent.includes('ABC12345'));assert(!f.state.calls.some(x=>x.name==='worker_device_events'));assert.equal(await f.page.locator('#trustedEvents button').count(),0);assert.equal(await f.page.evaluate(()=>__watchCount),0);await f.page.close()});
  await test('Declining an invitation saves response without joining or starting GPS',async()=>{const f=await fixture({trusted:true});await f.page.waitForSelector('#trustedEvents button');await f.page.locator('#trustedEvents button').nth(1).click();assert(f.state.calls.some(x=>x.name==='worker_device_respond'&&x.args.p_response==='declined'));assert(!f.state.calls.some(x=>x.name==='worker_device_join_event'));assert.equal(await f.page.evaluate(()=>__watchCount),0);await f.page.close()});
  console.log(`${passes} browser behavioral tests passed. Native Android/device behavior is not covered.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1});
