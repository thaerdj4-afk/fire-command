/* Optional HQ feature: never blocks the map, workers, events or realtime. */
window.createHQWorkerCodes=function(cloud){
 const $=id=>document.getElementById(id),input=$('hqWorkerCode'),note=$('hqWorkerCodeNote'),copy=$('hqCopyWorkerCode'),fresh=$('hqNewWorkerCode');
 if(!input||!note||!copy||!fresh)return {sync(){},reset(){}};
 let target=null,current=null,epoch=0,lastEvent=null;const cache=new Map();
 const authorized=()=>document.documentElement.classList.contains('hq-authorized');
 function empty(message){input.value='';note.textContent=message;copy.disabled=true;fresh.disabled=true;}
 function render(entry){if(!authorized())return empty('יש להתחבר לחפ״ק');input.value=entry.code||'';copy.disabled=!entry.code;fresh.disabled=!!entry.loading;note.textContent=entry.loading?'יוצר קוד כניסה...':entry.error?'יצירת קוד נכשלה: '+entry.error:'קוד חדש לכניסת עובדים • החיבורים הקיימים נשארים פעילים';}
 function share(){
  if(!authorized()||!lastEvent||!current?.code||current.loading)return alert('המתן לקוד כניסה של אירוע פעיל');
  const name=String(lastEvent.name||'').trim();
  const message=['🔥 אירוע שריפה'+(name?' — '+name:''),'קוד כניסה: '+current.code,'מספר אירוע: '+(lastEvent.event_number??'—')].join('\n');
  window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
 }
 function reset(){epoch++;target=null;current=null;lastEvent=null;cache.clear();empty('פתח אירוע פעיל לקבלת קוד');}
 async function sync(event){
  if(!authorized()){reset();return;}
  if(!event?.id||event.status!=='active'){target=null;current=null;lastEvent=null;empty('פתח אירוע פעיל לקבלת קוד');return;}
  target=event.id;lastEvent=event;const id=event.id,run=epoch;
  if(cache.has(id)){current=cache.get(id);render(current);return;}
  const entry={loading:true,code:null,error:null};cache.set(id,entry);current=entry;render(entry);
  try{const r=await cloud.rpc('hq_fresh_worker_event_code',{p_event_id:id});if(r.error)throw r.error;if(typeof r.data!=='string'||!/^[0-9a-f]{32}$/.test(r.data))throw Error('השרת לא החזיר קוד תקין');entry.code=r.data;}
  catch(e){entry.error=e?.message||'אין חיבור לשרת';}
  finally{entry.loading=false;if(run===epoch&&id===target){current=entry;render(entry);}}
 }
 copy.onclick=async()=>{if(!authorized()||!current?.code)return;const code=current.code,id=target,run=epoch;
  try{await navigator.clipboard.writeText(code);if(run===epoch&&id===target)note.textContent='✓ הקוד הועתק — הדבק באפליקציית עובד';}
  catch{if(run===epoch&&id===target){input.focus();input.select();note.textContent='בחר את הקוד והעתק ידנית';}}
 };
 fresh.onclick=()=>{if(!authorized()||!lastEvent||current?.loading)return;cache.delete(target);void sync(lastEvent);};
 reset();return {sync,reset,share};
};
