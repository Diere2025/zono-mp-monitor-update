// A reserve monitor uses its own tab ownership and alarm; it never claims
// the Activity or Banking monitor slots in this Chrome profile.
(function(){
 const reservePaths=__ZONO_RESERVE_PATHS__,alarm='RESERVE_MONITOR_PULSE';
 const valid=tab=>{try{const url=new URL(tab?.url||'');return ['mercadopago.com.ar','www.mercadopago.com.ar'].includes(url.hostname)&&url.protocol==='https:'&&reservePaths.includes(url.pathname.replace(/\/$/,''));}catch{return false;}};
 const interval=value=>Math.max(60,Math.min(86400,Number(value)||60))*1000;
 const get=keys=>new Promise(resolve=>chrome.storage.local.get(keys,resolve));
 const set=patch=>new Promise(resolve=>chrome.storage.local.set(patch,resolve));
 const tabById=id=>new Promise(resolve=>chrome.tabs.get(id,tab=>resolve(chrome.runtime.lastError?null:tab)));
 let pulsing=false;
 async function pulse(){
  if(pulsing)return;pulsing=true;
  try{
   const state=await get(['reserveMonitorEnabled','reserveMonitorTabId','reserveMonitorLastRecoveryAt']);
   if(state.reserveMonitorEnabled===false)return;
   let tab=state.reserveMonitorTabId?await tabById(state.reserveMonitorTabId):null;
   if(!valid(tab)){
    const tabs=await chrome.tabs.query({url:'https://*.mercadopago.com.ar/*'});
    tab=tabs.find(valid);if(!tab)return;
    await new Promise(resolve=>claim(tab.id,state.reserveMonitorTabId,interval(),resolve));
   }
   const response=await new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(null),8000);
    chrome.tabs.sendMessage(tab.id,{action:'RESERVE_MONITOR_TICK'}).then(value=>{clearTimeout(timer);resolve(value);},()=>{clearTimeout(timer);resolve(null);});
   });
   if(response?.received)return;
   // Persist the cooldown before navigating; worker restarts must not loop reloads.
   if(state.reserveMonitorLastRecoveryAt&&Date.now()-state.reserveMonitorLastRecoveryAt<300000)return;
   const current=await get(['reserveMonitorEnabled','reserveMonitorTabId']);
   if(current.reserveMonitorEnabled===false||current.reserveMonitorTabId!==tab.id)return;
   await set({reserveMonitorLastRecoveryAt:Date.now(),reserveMonitorRecoveryReason:'reader_unresponsive'});
   await chrome.tabs.reload(tab.id);
  }catch(error){console.warn('[Zono] Recuperación de reserva:',error.message);}
  finally{pulsing=false;}
 }
 function claim(tabId,prior,ms,reply){const nextReloadAt=Date.now()+ms;chrome.storage.local.set({reserveMonitorEnabled:true,reserveMonitorTabId:tabId,reserveMonitorNextReloadAt:nextReloadAt},()=>{chrome.alarms.create(alarm,{periodInMinutes:0.5});if(prior&&prior!==tabId)chrome.tabs.sendMessage(prior,{action:'RESERVE_MONITOR_CHANGED',active:false}).catch(()=>{});reply({ok:true,active:true,enabled:true,nextReloadAt});});}
 chrome.runtime.onMessage.addListener((request,sender,reply)=>{
  if(!['RESERVE_MONITOR_STATE','RESERVE_MONITOR_START','RESERVE_MONITOR_STOP','RESERVE_MONITOR_RELOAD'].includes(request.action))return;
  if(!sender.tab?.id||!valid(sender.tab)){reply({ok:false,error:'Pestaña de reserva inválida'});return;}
  chrome.storage.local.get(['reserveMonitorEnabled','reserveMonitorTabId','reserveMonitorNextReloadAt'],state=>{
   const id=sender.tab.id;
   if(request.action==='RESERVE_MONITOR_START'){claim(id,state.reserveMonitorTabId,interval(request.intervalSeconds),reply);return;}
   if(request.action==='RESERVE_MONITOR_STOP'){
    if(state.reserveMonitorTabId&&state.reserveMonitorTabId!==id){reply({ok:false,error:'Esta pestaña no es el monitor activo'});return;}
    chrome.storage.local.set({reserveMonitorEnabled:false,reserveMonitorTabId:null,reserveMonitorNextReloadAt:0},()=>{chrome.alarms.clear(alarm);reply({ok:true,active:false,enabled:false});});return;
   }
   if(request.action==='RESERVE_MONITOR_RELOAD'){
    if(!state.reserveMonitorEnabled||state.reserveMonitorTabId!==id){reply({ok:false,error:'Monitor de reserva inactivo'});return;}
    if(Date.now()<Number(state.reserveMonitorNextReloadAt)){reply({ok:true,skipped:true,nextReloadAt:state.reserveMonitorNextReloadAt});return;}
    const nextReloadAt=Date.now()+interval(request.intervalSeconds);chrome.storage.local.set({reserveMonitorNextReloadAt:nextReloadAt},()=>{reply({ok:true,nextReloadAt});setTimeout(()=>{const url=new URL(sender.tab.url);if(url.search||url.hash)chrome.tabs.update(id,{url:url.origin+url.pathname.replace(/\/$/,'')});else chrome.tabs.reload(id);},100);});return;
   }
   // New profiles start automatically; an explicit manual pause remains paused.
   if(state.reserveMonitorEnabled===false){reply({ok:true,active:false,enabled:false});return;}
   chrome.alarms.create(alarm,{periodInMinutes:0.5});
   if(state.reserveMonitorTabId===id){reply({ok:true,active:true,enabled:true,nextReloadAt:state.reserveMonitorNextReloadAt||Date.now()+interval(request.intervalSeconds)});return;}
   if(!state.reserveMonitorTabId){claim(id,null,interval(request.intervalSeconds),reply);return;}
   chrome.tabs.get(state.reserveMonitorTabId,tab=>{if(chrome.runtime.lastError||!valid(tab))claim(id,state.reserveMonitorTabId,interval(request.intervalSeconds),reply);else reply({ok:true,active:false,enabled:true,otherTab:true});});
  });return true;
 });
 chrome.alarms.onAlarm.addListener(event=>{if(event.name===alarm)return pulse();});
 chrome.tabs.onRemoved.addListener(id=>{chrome.storage.local.get(['reserveMonitorTabId'],state=>{if(state.reserveMonitorTabId===id)chrome.storage.local.set({reserveMonitorTabId:null});});});
 chrome.tabs.onUpdated.addListener((id,change,tab)=>{if(change.status!=='complete'&&!change.url)return;chrome.storage.local.get(['reserveMonitorTabId'],state=>{if(state.reserveMonitorTabId===id&&!valid(tab)&&tab.status!=='loading'){chrome.storage.local.set({reserveMonitorTabId:null});chrome.tabs.sendMessage(id,{action:'RESERVE_MONITOR_CHANGED',active:false}).catch(()=>{});}});});
 // Recreate the alarm whenever Chrome starts a new service worker.
 chrome.storage.local.get(['reserveMonitorEnabled'],state=>{if(state.reserveMonitorEnabled!==false)chrome.alarms.create(alarm,{periodInMinutes:0.5});});
 chrome.runtime.onStartup.addListener(()=>{chrome.storage.local.get(['reserveMonitorEnabled'],state=>{if(state.reserveMonitorEnabled!==false)chrome.alarms.create(alarm,{periodInMinutes:0.5});});});
})();
