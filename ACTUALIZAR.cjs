const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function update(extensionPath,packagePath=__dirname){
 if(!extensionPath)throw Error('Indicá la carpeta actual de Zono MP Monitor.');
 const target=fs.realpathSync(extensionPath),file=name=>path.join(target,name);
 const names=['manifest.json','content.js','banking.js','capture-refresh.js'];
 const originals=new Map(names.map(name=>[name,fs.readFileSync(file(name))]));
 const manifest=JSON.parse(originals.get('manifest.json').toString('utf8'));
 if(manifest.name!=='Zono - Mercado Pago Monitor'||!['1.7.5','1.7.6'].includes(manifest.version))throw Error('Se requiere Zono MP Monitor 1.7.5 o 1.7.6.');
 const content=originals.get('content.js').toString('utf8'),start=content.indexOf('function getRowDate('),end=content.indexOf('// Helper to extract clean activity item');
 if(start<0||end<=start)throw Error('No se reconoce el lector de fechas; no se modificaron archivos.');
 const refresh=originals.get('capture-refresh.js').toString('utf8');
 if(!refresh.includes('getRowDate(el)?.dateStr')&&!refresh.includes('getRowDate(el,{requireEvidence:true})?.dateStr'))throw Error('No se reconoce el lector de historial.');
 const oldBank=originals.get('banking.js').toString('utf8');
 if(!oldBank.includes('dateResolver(el)')&&!oldBank.includes('dateResolver(el,{requireEvidence:true})'))throw Error('No se reconoce el lector bancario.');
 const dateCode=fs.readFileSync(path.join(packagePath,'date-resolver.txt'),'utf8'),bankCode=fs.readFileSync(path.join(packagePath,'banking.js'),'utf8');
 if(!dateCode.startsWith('function getRowDate(')||!dateCode.includes('requireEvidence')||!bankCode.includes('dateResolver(el,{requireEvidence:true})'))throw Error('El paquete de actualización está incompleto.');
 manifest.version='1.7.6';
 const next=new Map([
  ['manifest.json',JSON.stringify(manifest,null,2)+'\n'],
  ['content.js',content.slice(0,start)+dateCode+content.slice(end)],
  ['banking.js',bankCode],
  ['capture-refresh.js',refresh.replace('getRowDate(el)?.dateStr','getRowDate(el,{requireEvidence:true})?.dateStr')]
 ]);
 const backup=path.join(target,'respaldo-antes-1.7.6-'+crypto.randomUUID());fs.mkdirSync(backup);
 for(const [name,bytes] of originals)fs.writeFileSync(path.join(backup,name),bytes);
 try{for(const [name,bytes] of next)fs.writeFileSync(file(name),bytes,'utf8');}
 catch(error){for(const [name,bytes] of originals)fs.writeFileSync(file(name),bytes);throw error;}
 return {version:'1.7.6',backup};
}
module.exports={update};
if(require.main===module){try{const result=update(process.argv[2]);console.log('Actualización aplicada: '+result.version+'. Recargá la extensión y las pestañas de Mercado Pago.');console.log('Respaldo: '+result.backup);}catch(error){console.error(error.message);process.exitCode=1;}}
