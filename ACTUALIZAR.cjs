const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const requestMonitorState=`let monitorStatePending=false,monitorStateRetryAt=0,monitorStateKnown=false,monitorStateOtherTab=false;
function requestMonitorState() {
  if(globalThis.ZonoMonitorUI?.matches()===false){isMonitorTab=false;updateMonitorWidget();return;}
  if(globalThis.ZonoExtensionContext?.alive()===false||monitorStatePending)return;
  monitorStatePending=true;monitorStateRetryAt=Date.now()+10000;
  let settled=false;
  const finish=(response,error)=>{
    if(settled)return;settled=true;clearTimeout(timer);monitorStatePending=false;
    if(error||typeof response?.active!=='boolean'){
      monitorStateKnown=false;monitorStateOtherTab=false;updateMonitorWidget();return;
    }
    monitorStateKnown=true;monitorStateOtherTab=response.active===false;
    const becameActive=!isMonitorTab&&response.active;isMonitorTab=response.active;updateMonitorWidget();
    if(becameActive){scanDOMActivities();sendHeartbeat();}
  };
  const timer=setTimeout(()=>finish(null,'timeout'),5000);
  try{chrome.runtime.sendMessage({action:'GET_MONITOR_STATE'},response=>finish(response,chrome.runtime.lastError?.message));}
  catch(error){finish(null,error.message);}
}
setInterval(()=>{if(Date.now()>=monitorStateRetryAt)requestMonitorState();},10000);
`;
const recovery=`let activityRecoveryPending=false;
async function recoverActivityMonitor(){
 if(activityRecoveryPending)return;activityRecoveryPending=true;
 try{
  const state=await chrome.storage.local.get(['monitorTabId']);
  const owner=state.monitorTabId?await new Promise(resolve=>chrome.tabs.get(state.monitorTabId,tab=>resolve(chrome.runtime.lastError?null:tab))):null;
  if(owner&&(isActivitiesTab(owner)||owner.status==='loading'))return;
  const tabs=await chrome.tabs.query({url:['https://*.mercadopago.com.ar/activities*','https://mercadopago.com.ar/activities*']});
  const candidate=tabs.filter(tab=>isActivitiesTab(tab)&&!tab.discarded).sort((a,b)=>a.id-b.id)[0];
  if(!candidate)return;
  // The query is asynchronous; preserve a newer explicit selection made meanwhile.
  const current=await chrome.storage.local.get(['monitorTabId']);
  if(current.monitorTabId!==state.monitorTabId)return;
  await new Promise(resolve=>saveMonitorTab(candidate.id,state.monitorTabId,resolve));
 }catch(error){console.warn('[Zono] Recuperacion de Actividades:',error.message);}
 finally{activityRecoveryPending=false;}
}
`;
function once(source,old,next){if(!source.includes(old))throw Error('No se reconoce la version instalada; no se modificaron archivos.');return source.replace(old,next);}
function transform(background,content){
 // Keep existing settings, webhook handling, banking and reserve code intact.
 background=once(background,'function isActivitiesTab(tab) {',recovery+'\nfunction isActivitiesTab(tab) {');
 background=once(background,'url.pathname.startsWith("/activities")','url.protocol === "https:" && url.pathname.replace(/\\/$/, "") === "/activities"');
 background=once(background,'function pingAllTabs() {','function pingAllTabs() {\n  void recoverActivityMonitor();');
 background=once(background,'setInterval(pingAllTabs, 10000);','setInterval(pingAllTabs, 10000);\nsetupAlarms();\nvoid recoverActivityMonitor();');
 background=once(background,'if (!changeInfo.url && changeInfo.status !== "complete") return;','if (!changeInfo.url && changeInfo.status !== "complete") return;\n  if(isActivitiesTab(tab))void recoverActivityMonitor();');
 background=once(background,'if (monitorTabId === tabId) scheduleWrongPageCheck();','if (monitorTabId === tabId) { scheduleWrongPageCheck(); void recoverActivityMonitor(); }');
 const old='let isMercadoPago = false;\n        try { isMercadoPago = new URL(storedTab?.url || "").hostname.endsWith("mercadopago.com.ar"); } catch {}\n        if (chrome.runtime.lastError || !storedTab || !isMercadoPago) {';
 background=once(background,old,'if (chrome.runtime.lastError || !storedTab || (!isActivitiesTab(storedTab) && storedTab.status !== "loading")) {');
 const start=content.indexOf('function requestMonitorState() {'),end=content.indexOf('function claimThisTabAsMonitor()',start);
 if(start<0||end<start)throw Error('No se reconoce el lector instalado.');
 content=content.slice(0,start)+requestMonitorState+'\n'+content.slice(end);
 content=once(content,'button.textContent = isMonitorTab ? "✓ Pestaña monitor" : "Activar aquí";', 'button.textContent = isMonitorTab ? "✓ Pestaña monitor" : monitorStateKnown ? "Activar aquí" : "Reconectando…";');
 content=once(content,': "en pausa";', ': monitorStateOtherTab ? "monitor en otra pestaña" : "reconectando…";');
 content=once(content,'if (!response?.ok) return;\n    isMonitorTab = true;', 'if (chrome.runtime.lastError || !response?.ok) return;\n    monitorStateKnown=true;monitorStateOtherTab=false;isMonitorTab = true;');
 content=once(content,'isMonitorTab = Boolean(msg.active);\n      updateMonitorWidget();','monitorStateKnown=true;monitorStateOtherTab=!msg.active;isMonitorTab = Boolean(msg.active);\n      updateMonitorWidget();');
 content=once(content,'if (document.visibilityState === "visible") {','if (document.visibilityState === "visible") {\n      requestMonitorState();');
 content=once(content,'window.addEventListener("focus", () => {','window.addEventListener("focus", () => {\n    requestMonitorState();');
 new vm.Script(background);new vm.Script(content);return {background,content};
}
function update(extensionPath){
 if(!extensionPath)throw Error('Indica la carpeta actual de Zono MP Monitor.');
 const target=fs.realpathSync(extensionPath),names=['manifest.json','background.js','content.js'];
 const originals=new Map(names.map(name=>[name,fs.readFileSync(path.join(target,name))]));
 const manifest=JSON.parse(originals.get('manifest.json').toString('utf8'));
 if(manifest.name!=='Zono - Mercado Pago Monitor'||!['1.7.7','1.7.8'].includes(manifest.version))throw Error('Primero se requiere la version 1.7.7.');
 if(manifest.version==='1.7.8'){
  if(!originals.get('background.js').toString().includes('async function recoverActivityMonitor()')||!originals.get('content.js').toString().includes('monitorStateRetryAt'))throw Error('Instalacion 1.7.8 incompleta.');
  return {version:'1.7.8',unchanged:true};
 }
 const normalize=bytes=>bytes.toString('utf8').replace(/\r\n/g,'\n');
 const patched=transform(normalize(originals.get('background.js')),normalize(originals.get('content.js')));
 manifest.version='1.7.8';
 const next={'manifest.json':JSON.stringify(manifest,null,2)+'\n','background.js':patched.background,'content.js':patched.content};
 const backup=path.join(target,'respaldo-antes-1.7.8-'+crypto.randomUUID());fs.mkdirSync(backup);
 for(const [name,bytes]of originals)fs.writeFileSync(path.join(backup,name),bytes);
 try{for(const name of names)fs.writeFileSync(path.join(target,name),next[name]);}
 catch(error){for(const [name,bytes]of originals)fs.writeFileSync(path.join(target,name),bytes);throw error;}
 return {version:'1.7.8',backup};
}
module.exports={transform,update};
if(require.main===module){try{console.log(JSON.stringify(update(process.argv[2])));console.log('Recarga la extension en chrome://extensions y las pestanas de Mercado Pago.');}catch(e){console.error(e.message);process.exitCode=1;}}
