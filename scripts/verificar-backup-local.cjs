'use strict';
// Leitura local apenas. Não conecta ao banco e não altera o arquivo.
const fs=require('node:fs');
try {
  const file=process.argv[2];
  if(!file)throw Error('Uso: node scripts/verificar-backup-local.cjs caminho-do-backup.json');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.app!=='Solar Clean Vistorias v4'||!Array.isArray(data.vistorias))throw Error('Formato de backup não reconhecido.');
  if(!Number.isFinite(Date.parse(data.exportedAt)))throw Error('Data de exportação inválida.');
  const ids=new Set();let pending=0,inlineImages=0,remoteReferences=0;
  function inspect(value){
    if(typeof value==='string'){
      if(/^data:image\//i.test(value))inlineImages++;
      else if(/^https?:\/\//i.test(value))remoteReferences++;
    } else if(Array.isArray(value))value.forEach(inspect);
    else if(value&&typeof value==='object')Object.values(value).forEach(inspect);
  }
  for(const row of data.vistorias){
    if(!row||typeof row!=='object'||Array.isArray(row)||row.id==null)throw Error('Vistoria sem identificação.');
    const key=String(row.id);if(ids.has(key))throw Error('Identificação local repetida.');ids.add(key);
    if(row.syncStatus!=='synced')pending++;
    inspect(row);
  }
  console.log(JSON.stringify({estrutura:'válida',exportadoEm:data.exportedAt,vistorias:data.vistorias.length,
    naoMarcadasComoSincronizadas:pending,imagensIncorporadas:inlineImages,referenciasWeb:remoteReferences,
    limite:'Não comprova integridade das imagens, restauração, backup do banco ou cobertura de agenda/CRM/fechamentos.'},null,2));
} catch(error){console.error(error.message);process.exitCode=1;}
