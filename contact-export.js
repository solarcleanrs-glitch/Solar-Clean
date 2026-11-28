// Pure export helpers; no customer data is stored here.
(function(root){
'use strict';
const ddds=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
function phone(value){
 const s=String(value||'').trim();
 if(!/^\+?[\d().\s-]+$/.test(s))return null;
 let n=s.replace(/\D/g,'');
 if(n.length===12||n.length===13){if(!n.startsWith('55'))return null;n=n.slice(2);}
 else if(s.startsWith('+'))return null;
 if(!ddds.has(n.slice(0,2))||!/^\d{2}(9\d{8}|[2-5]\d{7})$/.test(n))return null;
 return '+55'+n;
}
function cutoff(today,months){
 const d=new Date(today+'T12:00:00Z'),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-months);
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);
}
function prepare(rows,opts){
 const groups=new Map(),counts={invalid:0,duplicate:0,unauthorized:0,conflict:0,excluded:0};
 for(const r of rows){
  const p=phone(r.telefone);
  if(!p){counts.invalid++;continue;}
  if(!groups.has(p))groups.set(p,[]);
  groups.get(p).push(r);
 }
 const contacts=[];
 for(const [p,g] of groups){
  counts.duplicate+=g.length-1;
  const units=new Set(g.map(r=>r.unidade));
  const names=new Set(g.map(r=>String(r.cliente||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).filter(Boolean));
  if(units.size!==1||names.size!==1||!['RS','SC'].includes(g[0].unidade)){counts.conflict++;continue;}
  if(g.some(r=>r.status_comercial==='Não contatar'||r.autorizacao!==true)){counts.unauthorized++;continue;}
  const unit=g[0].unidade;
  if(!opts.allowedUnits.includes(unit)||opts.unit&&opts.unit!==unit){counts.excluded++;continue;}
  const dates=g.map(r=>r.ultima_limpeza).filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=opts.today).sort();
  const last=dates.at(-1)||'';
  if(opts.months&&(!last||last>=cutoff(opts.today,opts.months))){counts.excluded++;continue;}
  const r=g.find(r=>r.ultima_limpeza===last)||g[0];
  contacts.push({name:['Solar Clean',unit,String(r.cliente).trim(),String(r.cidade||'').trim()].filter(Boolean).join(' - '),phone:p,unit,last});
 }
 contacts.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return {contacts,counts};
}
function csv(contacts){
 const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
 return '\uFEFF'+[['First Name','Phone 1 - Label','Phone 1 - Value','Labels'],...contacts.map(c=>[c.name,'Mobile',c.phone,'Solar Clean '+c.unit])].map(r=>r.map(q).join(',')).join('\r\n')+'\r\n';
}
const api={phone,cutoff,prepare,csv};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SolarContactExport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
