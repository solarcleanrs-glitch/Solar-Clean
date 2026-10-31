'use strict';
const fs=require('node:fs'),path=require('node:path');
for(const name of ['google-history-review','client-history-import-plan']){
 const source=fs.readFileSync(path.join(__dirname,'../lib',name+'.cjs'),'utf8');
 const destination=path.join(__dirname,'../lib',name+'.js');
 if(process.argv.includes('--check')){if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==source)throw Error('Atualize '+name+'.js');}
 else fs.writeFileSync(destination,source);
}
