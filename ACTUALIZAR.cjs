const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function update(extensionPath,packagePath=__dirname){
 if(!extensionPath)throw Error('Indicá la carpeta actual de Zono MP Monitor.');
 const target=fs.realpathSync(extensionPath),names=['manifest.json','reserve-monitor.js','reserve-reader.js'];
 const originals=new Map(names.map(name=>[name,fs.readFileSync(path.join(target,name))]));
 const manifest=JSON.parse(originals.get('manifest.json').toString('utf8'));
 if(manifest.name!=='Zono - Mercado Pago Monitor'||!['1.7.5','1.7.6','1.7.7'].includes(manifest.version))throw Error('Se requiere Zono MP Monitor 1.7.5, 1.7.6 o 1.7.7.');
 const background=fs.readFileSync(path.join(target,manifest.background.service_worker),'utf8');
 if(!background.includes('importScripts("reserve-monitor.js")')&&!background.includes("importScripts('reserve-monitor.js')"))throw Error('La instalación no carga el monitor de reserva.');
 let monitor=fs.readFileSync(path.join(packagePath,'reserve-monitor.js'),'utf8'),reader=fs.readFileSync(path.join(packagePath,'reserve-reader.js'),'utf8');
 if(monitor.includes('__ZONO_RESERVE_PATHS__')||reader.includes('__ZONO_RESERVES__')){
  const paths=originals.get('reserve-monitor.js').toString('utf8').match(/const reservePaths=(\[[^\r\n]*?\]),alarm=/)?.[1];
  const reserves=originals.get('reserve-reader.js').toString('utf8').match(/const reserves=(\{[\s\S]*?\});const reserveId=/)?.[1];
  if(!paths||!reserves)throw Error('No se reconoce la configuración de reservas; no se modificaron archivos.');
  monitor=monitor.replace('__ZONO_RESERVE_PATHS__',()=>paths);reader=reader.replace('__ZONO_RESERVES__',()=>reserves);
 }
 if(!monitor.includes('reader_unresponsive')||!reader.includes('refreshMonitorState'))throw Error('Paquete de recuperación incompleto.');
 new (require('node:vm').Script)(monitor);new (require('node:vm').Script)(reader);
 manifest.version='1.7.7';
 const next=new Map([['manifest.json',JSON.stringify(manifest,null,2)+'\n'],['reserve-monitor.js',monitor],['reserve-reader.js',reader]]);
 const backup=path.join(target,'respaldo-antes-1.7.7-'+crypto.randomUUID());fs.mkdirSync(backup);
 for(const [name,bytes]of originals)fs.writeFileSync(path.join(backup,name),bytes);
 try{for(const [name,bytes]of next)fs.writeFileSync(path.join(target,name),bytes);}
 catch(error){for(const [name,bytes]of originals)fs.writeFileSync(path.join(target,name),bytes);throw error;}
 return {version:'1.7.7',backup};
}
module.exports={update};
if(require.main===module){try{const result=update(process.argv[2]);console.log('Actualización aplicada: '+result.version+'. Recargá la extensión y las pestañas de Mercado Pago.');console.log('Respaldo: '+result.backup);}catch(error){console.error(error.message);process.exitCode=1;}}
