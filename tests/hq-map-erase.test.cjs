const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('/* Restore persistent selective erasing');
const end=html.indexOf('let freePointerId=null',start);
assert(start>=0&&end>start,'persistent erase listener should be registered');
assert(html.includes('<button id="measureArea">🔥 פוליגון שריפה</button>'),'fire polygon button missing');
const main=html.slice(html.indexOf('<div class="toolGrid coreTools">'),html.indexOf('<div id="drawmsg"'));
assert(main.includes('id="erase"'),'erase button must be visible in primary tools');
assert.equal([...html.matchAll(/id="erase"/g)].length,1,'erase button must be unique');
function setup({kind='fire-polygon',fail=false,pending=false,active=true}={}){
 const layer={_id:'item-1',_kind:kind},mapLayers=new Map([[layer._id,layer]]),pendingMap=new Set(pending?[layer._id]:[]);
 let removed=0,recounted=0,windClears=0,deleteRequests=0;const elements={},callbacks={};
 const c={
  ev:active?{id:'event-1'}:null,eraseMode:true,mapLayers,pendingMap,stack:[layer],console,
  $:id=>elements[id]||(elements[id]={textContent:''}),
  ops:{on(name,fn){callbacks[name]=fn},removeLayer(value){assert.equal(value,layer);removed++}},
  L:{DomEvent:{stopPropagation(){}}},
  cloud:{from(table){assert.equal(table,'map_items');return{
   delete(){deleteRequests++;return this},
   eq(key,value){assert(['id','event_id'].includes(key));return this},
   async select(){return fail?{error:{message:'permission denied'}}:{data:[{id:'item-1'}],error:null}}
  }}},
  recountMap(){recounted++},windLayer:{clearLayers(){windClears++}},
  fireSpreadLayer:{clearLayers(){}}
 };
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);
 return {c,layer,mapLayers,callbacks,elements,result:()=>({removed,recounted,windClears,deleteRequests})};
}
(async()=>{
 let t=setup();await t.callbacks.click({layer:t.layer,originalEvent:{}});
 assert.equal(t.result().removed,1);assert(!t.mapLayers.has('item-1'));assert.equal(t.result().deleteRequests,1);
 console.log('PASS map polygon erased in server and local view');
 t=setup({kind:'fire'});await t.callbacks.click({layer:t.layer,originalEvent:{}});
 assert.equal(t.result().windClears,1);console.log('PASS fire marker erasure clears stale wind overlays');
 t=setup({fail:true});await t.callbacks.click({layer:t.layer,originalEvent:{}});
 assert.equal(t.result().removed,0);assert(t.mapLayers.has('item-1'));assert.match(t.elements.drawmsg.textContent,/נכשלה/);
 console.log('PASS failed server deletion retains map item and shows an error');
 t=setup({pending:true});await t.callbacks.click({layer:t.layer,originalEvent:{}});
 assert.equal(t.result().deleteRequests,0);assert(t.mapLayers.has('item-1'));
 console.log('PASS eraser waits for pending map item persistence');
 t=setup({active:false});await t.callbacks.click({layer:t.layer,originalEvent:{}});
 assert.equal(t.result().deleteRequests,0);console.log('PASS eraser does not delete without active event');
})().catch(error=>{console.error(error);process.exitCode=1});
