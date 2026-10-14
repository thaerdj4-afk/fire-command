window.createTrustedWorkerHome=function({cloud,bridge,show,text,chooseEvent,normalizePhone}){
 const $=id=>document.getElementById(id);let identity=null,profile=null,busy=false;
 try{identity=JSON.parse(bridge?.trustedIdentity?.()||localStorage.getItem('workerTrustedDeviceV1')||'null')}catch{}
 const equipment=()=>[...document.querySelectorAll('#trustedEquipment input:checked')].map(x=>x.value);
 const save=v=>{if(bridge?.saveTrustedIdentity){if(!bridge.saveTrustedIdentity(v.id,v.token))throw Error('לא ניתן לשמור את החשבון במכשיר')}else localStorage.setItem('workerTrustedDeviceV1',JSON.stringify(v));identity=v};
 async function rpc(name,args={}){const r=await cloud.rpc(name,{p_device_id:identity?.id,p_device_token:identity?.token,...args});if(r.error)throw r.error;return r.data}
 function card(tag,value){const e=document.createElement(tag);e.textContent=value;return e}
 async function refresh(){if(busy)return;busy=true;text('trustedError','');try{
  if(!identity){$('trustedEnroll').hidden=false;$('trustedEvents').replaceChildren();text('trustedStatus','רישום פעם אחת ואישור מנהל');return}
  $('trustedEnroll').hidden=true;profile=await rpc('worker_device_profile');if(!profile)throw Error('החשבון לא בתוקף. פנה למנהל לאישור מכשיר חדש');
  text('trustedStatus',profile.name+' • '+({pending:'ממתין לאישור מנהל',approved:'עובד מאושר',revoked:'האישור בוטל'}[profile.status]||profile.status)+' • קוד מכשיר '+profile.fingerprint);
  document.querySelectorAll('#trustedEquipment input').forEach(x=>x.checked=(profile.equipment||[]).includes(x.value));
  if(profile.status!=='approved'){$('trustedEvents').replaceChildren();return}
  const push=bridge?.pushToken?.();if(push)await rpc('worker_device_set_push_token',{p_push_token:push});
  text('trustedPushNote',bridge?.pushStatus?.()||'התראות כשהאפליקציה סגורה זמינות בגרסת Android לאחר הגדרה ואישור הרשאה');
  const events=await rpc('worker_device_events');const box=$('trustedEvents');box.replaceChildren();for(const event of events||[]){const section=card('div','');section.className='card';section.append(card('h2','🔥 '+event.name),card('p','מספר אירוע: '+event.event_number));section.append(card('p',({pending:'⏳ ממתין לתשובתך',accepted:'✅ אישרת השתתפות',declined:'❌ לא זמין'}[event.response]||'אירוע פעיל')));
   const join=card('button','✅ השתתפות / הצטרפות');join.className='btn green';join.onclick=async()=>{join.disabled=true;try{if(event.response){const ok=await rpc('worker_device_respond',{p_event_id:event.id,p_response:'accepted'});if(!ok)throw Error('לא ניתן לאשר השתתפות')}chooseEvent(event,profile)}catch(e){text('trustedError',e.message)}finally{join.disabled=false}};section.append(join);
   if(event.response){const decline=card('button','❌ לא זמין');decline.className='btn smallbtn gap';decline.onclick=async()=>{decline.disabled=true;try{const ok=await rpc('worker_device_respond',{p_event_id:event.id,p_response:'declined'});if(!ok)throw Error('התשובה לא נשמרה');await refresh()}catch(e){text('trustedError',e.message)}finally{decline.disabled=false}};section.append(decline)}box.append(section)}
  if(!events?.length)box.append(card('p','אין אירועים פעילים כרגע'));
 }catch(e){text('trustedError',e.message||'לא ניתן לקבל אירועים')}finally{busy=false}}
 $('trustedRegister').onclick=async()=>{if(busy)return;busy=true;$('trustedRegister').disabled=true;text('trustedError','');try{const name=$('trustedName').value.trim(),phone=normalizePhone($('trustedPhone').value);if(name.length<2)throw Error('כתוב שם מלא');if(!$('trustedConsent').checked)throw Error('אשר הרשמה וקבלת הזמנות לאירועים');const r=await cloud.rpc('worker_request_device_approval',{p_name:name,p_phone:phone,p_equipment:equipment()});if(r.error)throw r.error;if(r.data?.error)throw Error(r.data.error);if(!r.data?.id||!r.data?.token)throw Error('לא התקבל אישור רישום');save({id:r.data.id,token:r.data.token});}catch(e){text('trustedError',e.message)}finally{busy=false;$('trustedRegister').disabled=false;if(identity)await refresh()}};
 $('trustedSaveEquipment').onclick=async()=>{try{if(!identity)throw Error('יש להירשם קודם');const ok=await rpc('worker_device_update_equipment',{p_equipment:equipment()});if(!ok)throw Error('הציוד לא נשמר');await refresh()}catch(e){text('trustedError',e.message)}};
 $('trustedOpen').onclick=()=>{show('trustedHome');void refresh()};$('trustedRefresh').onclick=()=>refresh();$('trustedCodeEntry').onclick=()=>chooseEvent(null,null);
 $('trustedNotify').onclick=()=>{bridge?.enablePushNotifications?.();setTimeout(()=>refresh(),1000)};
 return {hasIdentity:()=>!!identity,open:()=>{show('trustedHome');return refresh()},async join(eventId){if(!identity)throw Error('חשבון עובד חסר');return rpc('worker_device_join_event',{p_event_id:eventId})}};
};
