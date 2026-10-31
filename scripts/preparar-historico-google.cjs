'use strict';
const fs=require('node:fs');
const {prepareReview}=require('../lib/google-history-review.cjs');
const [source,destination]=process.argv.slice(2);
try{
  if(!source||!destination)throw Error('Uso: node scripts/preparar-historico-google.cjs entrada.json saida.json');
  if(fs.statSync(source).size>50*1024*1024)throw Error('Arquivo maior que 50 MB.');
  const result=prepareReview(JSON.parse(fs.readFileSync(source,'utf8')));
  // Exclusive create: never replace the source or an earlier review.
  fs.writeFileSync(destination,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(result.summary));
}catch(e){console.error(e.message);process.exitCode=1;}
