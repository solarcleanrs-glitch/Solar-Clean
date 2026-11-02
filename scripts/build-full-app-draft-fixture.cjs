'use strict';
const fs=require('node:fs');
let html=fs.readFileSync('index.html','utf8');
const environment=fs.readFileSync('tests/full-app-draft-env.js','utf8');
const registration="if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');";
if(!html.includes(registration))throw Error('Revisar isolamento do service worker.');
html=html.replace(registration,'/* Service worker disabled only in synthetic fixture. */');
html=html.replace(/<script\b[^>]*src="https?:[^>]*><\/script>/g,'');
const setup=environment+"\nlet syntheticSeed;try{syntheticSeed=parent.SCFullAppSyntheticSeed;}catch(e){}\nbootstrap(syntheticSeed||{actors:{A:crypto.randomUUID(),B:crypto.randomUUID()},fixtureId:crypto.randomUUID()});\n";
if(setup.includes('</script'))throw Error('Escape HTML in the synthetic bootstrap.');
html=html.replace('<head>','<head><base href="/">\n<script>'+setup+'</script>\n');
const target='tests/full-app-draft-sandbox.html';
if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==html)throw Error('Regerar fixture do aplicativo completo.');}
else fs.writeFileSync(target,html);
console.log('PASS: complete app fixture matches source; only storage/network environment, external loader and service worker differ');
