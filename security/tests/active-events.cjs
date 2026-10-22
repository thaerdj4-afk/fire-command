const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');const source=html.slice(html.indexOf('let eventStartBusy='),html.indexOf('\nasync function finish(){'));
function setup(){const elements={},rows=[{id:'older',event_number:100053,name:'Old',status:'active'},{id:'newer',event_number:100054,name:'New',status:'active'}].reverse();let inserts=0,resolve;const c={ev:null,started:null,workers:[],requests:[],lastWorkersSig:'',lastRequestsSig:'',lastAuxLoad:0,lastFireAreaM2:0,windLayer:{clearLayers(){}},sosLayer:{clearLayers(){}},Date,console,document:{activeElement:null,createElement:()=>({})},$:id=>elements[id]||(elements[id]={value:'',replaceChildren(){this.options=[]},append(o){this.options.push(o)}}),wl:{clearLayers(){}},ops:{clearLayers(){}},mapLayers:{clear(){}},stack:[],renderWorkers(){},renderSOS(){},showLivePanels(){},link(){},recountMap(){},syncMap:async()=>{},live:async()=>{},rt(){},alert(){},cloud:{from(){return{select(){return this},eq(){return this},order(){return c.hold?new Promise(r=>resolve=r):Promise.resolve({data:rows,error:null})},insert(){inserts++;return this},single(){return Promise.resolve({data:{id:'created',status:'active'},error:null})}}}}};vm.createContext(c);vm.runInContext(source,c);return{c,rows,elements,inserts:()=>inserts,release:()=>resolve({data:rows,error:null})}}
(async()=>{let x=setup();await x.c.restore();assert.equal(x.c.ev.id,'newer');assert.equal(x.elements.activeEventPickerWrap.hidden,false);assert.equal(x.elements.activeEventPicker.options.length,2);await x.c.restore('older');assert.equal(x.c.ev.id,'older');await x.c.restore();assert.equal(x.c.ev.id,'older');console.log('PASS both active events selectable; realtime restore preserves selected event');x.rows.splice(1,1);await x.c.restore();assert.equal(x.c.ev.id,'newer');assert.equal(x.elements.activeEventPickerWrap.hidden,false);console.log('PASS single remaining active event is visible and selectable');x=setup();await x.c.start();assert.equal(x.inserts(),0);assert(x.elements.estate.textContent.includes('100054'));console.log('PASS start shows existing server event number and prevents accidental duplicate');x=setup();x.rows.length=0;x.c.ev={id:'stale',name:'Closed fire',status:'active'};await x.c.start();assert.equal(x.inserts(),1);console.log('PASS stale in-memory event cannot block opening when database has no active event');x=setup();x.rows.length=0;x.c.hold=true;const pending=x.c.start();await x.c.start();assert.equal(x.inserts(),0);x.c.hold=false;x.release();await pending;assert.equal(x.inserts(),1);assert.equal(x.elements.start.disabled,false);console.log('PASS repeated click while request pending creates only one event');for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);console.log('PASS inline scripts compile')})().catch(e=>{console.error(e);process.exitCode=1});


{
 const helperStart=html.indexOf('/* Event helpers:');
 const helperEnd=html.indexOf('const markerSvg=',helperStart);
 assert(helperStart>=0&&helperEnd>helperStart,'HQ event helper declarations must exist');
 const elements={},calls=[];
 const $=id=>elements[id]||(elements[id]={textContent:'',value:'',style:{},replaceChildren(){},innerHTML:''});
 const c={console,window:{},location:{origin:'https://thaerdj4-afk.github.io',pathname:'/fire-command/index.html'},$,ev:{id:'event ABC',status:'active',event_number:100058,name:'Test'},counts:{engine:1,person:0,blower:0,water:1},workers:[],workerCodes:{sync:e=>calls.push(['code',e?.id])},trustedWorkers:{sync:e=>calls.push(['roster',e?.id])}};
 vm.createContext(c);vm.runInContext(html.slice(helperStart,helperEnd),c);
 c.link();c.showLivePanels(true);c.counter();
 assert.equal(elements.eventNumber.textContent,100058);
 assert.equal(elements.workerLink.value,'https://thaerdj4-afk.github.io/fire-command/worker.html?event=event%20ABC');
 assert.equal(elements.premiumBottom.style.display,'grid');
 assert.equal(calls.length,2);
 assert(elements.count.textContent.includes('🚒 1'));
 c.ev=null;c.link();c.showLivePanels(false);
 assert.equal(elements.eventNumber.textContent,'—');
 assert.equal(elements.workerLink.value,'');
 assert.equal(elements.premiumBottom.style.display,'none');
 console.log('PASS restored event helpers display event identity and worker link, sync worker access, and clear state');
}

const names=new Set([...html.matchAll(/onclick="([A-Za-z_$][\w$]*)\(/g)].map(m=>m[1]));for(const name of names)assert(new RegExp('(?:function\\s+'+name+'\\b|(?:window\\.)?'+name+'\\s*=)').test(html),'Missing handler '+name);console.log('PASS every inline button handler is defined');
