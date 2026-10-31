(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(key=>require('node:crypto').createHash('sha256').update(key).digest('hex'));
 else root.SCClientHistoryReview=factory(key=>'review:'+encodeURIComponent(key));
})(typeof window==='undefined'?this:window,function(hash){
'use strict';
// Pure review preparation. Never creates clients, appointments or financial records.
const FORMAT='solar-clean-google-calendar-history-v1';
const DDD=new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function normalize(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function plain(x){return String(x||'').replace(/<\s*(?:br\s*\/?|\/p|\/div)\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');}
function phone(value){let p=String(value).replace(/\D/g,'');if((p.length===12||p.length===13)&&p.startsWith('55'))p=p.slice(2);if(!DDD.has(p.slice(0,2)))return null;if(p.length===11&&p[2]==='9'||p.length===10&&/[2-5]/.test(p[2]))return '+55'+p;return null;}
function phones(text){
  const values=new Set(), s=plain(text);
  // Require an explicit telephone label/link or a formatted number with DDD.
  const patterns=[/(?:tel(?:efone)?|fone|cel(?:ular)?|whats(?:app)?|contato)\s*[:.\-]?\s*(\+?\d[\d ()\-.]{8,24}\d)/gi,/wa\.me\/(\d{10,13})\b/gi,/\((\d{2})\)\s*(\d{4,5})[\s-]?(\d{4})(?!\d)/g,/(?<!\d)(?:\+?55[\s.-]+)?(\d{2})[ .-]+(\d{4,5})-(\d{4})(?!\d)/g];
  patterns.forEach((re,i)=>{for(const m of s.matchAll(re)){const p=phone(i>=2?m[1]+m[2]+m[3]:m[1]);if(p)values.add(p);}});
  return [...values].sort();
}
function classify(title,location){
  const t=normalize(title), l=normalize(location);
  const origins=[/\byes\b/.test(t)&&'YES',/\belysia\b/.test(t)&&'Elysia',/\bparticular\b/.test(t)&&'Particular'].filter(Boolean);
  const units=[/\brs\b/.test(l)&&'RS',/\bsc\b/.test(l)&&'SC'].filter(Boolean);
  return {originSuggestion:origins.length===1?origins[0]:null,unitSuggestion:units.length===1?units[0]:null};
}
function prepareReview(input){
  if(!input||input.format!==FORMAT||!Array.isArray(input.events)||!input.sourceCalendar||input.paginationComplete!==true)throw Error('Exportação incompatível ou incompleta.');
  const byId=new Map();let duplicateEvents=0;
  for(const event of input.events){
    if(!event||typeof event.id!=='string'||!event.id.trim())throw Error('Evento sem identidade.');
    if(byId.has(event.id)){if(canonical(byId.get(event.id))!==canonical(event))throw Error('Mesmo ID com conteúdos diferentes.');duplicateEvents++;continue;}byId.set(event.id,event);
  }
  const groups=new Map();let excludedCancelled=0;
  for(const event of byId.values()){
    if(event.status==='cancelled'){excludedCancelled++;continue;}
    const title=String(event.summary||'').trim(), address=String(event.location||'').trim();
    const ps=phones(title+'\n'+(event.description||''));
    const flags=['confirmar_cliente','confirmar_realizacao_do_servico'];
    if(!title)flags.push('sem_nome');
    if(!address)flags.push('sem_endereco');
    if(!ps.length)flags.push('sem_telefone_identificado');
    if(ps.length>1)flags.push('multiplos_telefones');
    if(/\b(feriado|folga|viagem|cancelad[oa]|cancelamento|reuniao|bloquead[oa]|aniversario)\b/.test(normalize(title)))flags.push('possivel_evento_sem_cliente');
    const classification=classify(title,address);
    if(!classification.originSuggestion)flags.push('confirmar_origem');
    if(!classification.unitSuggestion)flags.push('confirmar_unidade');
    // Only propose grouping when name AND full address AND sole phone agree.
    // Without all three, preserve one candidate per event; no fuzzy merging.
    const key=ps.length===1&&title&&address?canonical([ps[0],normalize(title),normalize(address)]):canonical(['event',event.id]);
    let g=groups.get(key);
    if(!g){g={reviewId:hash(input.sourceCalendar+'\0'+key),suggestedName:title,phoneCandidates:ps,addressSuggestion:address,...classification,reviewRequired:true,flags,events:[]};groups.set(key,g);}
    g.events.push({...event,sourceKey:input.sourceCalendar+':'+event.id});
  }
  const candidates=[...groups.values()].sort((a,b)=>a.reviewId.localeCompare(b.reviewId));
  const byPhone=new Map();for(const c of candidates)for(const p of c.phoneCandidates){if(!byPhone.has(p))byPhone.set(p,[]);byPhone.get(p).push(c);}
  for(const rows of byPhone.values())if(rows.length>1)for(const c of rows)if(!c.flags.includes('telefone_em_outro_candidato'))c.flags.push('telefone_em_outro_candidato');
  return {format:'solar-clean-client-history-review-v1',sourceCalendar:input.sourceCalendar,sourceWindow:input.window,sourceExportedAt:input.exportedAt,summary:{sourceEvents:input.events.length,uniqueEvents:byId.size,duplicateEvents,excludedCancelled,candidates:candidates.length,eventsForReview:candidates.reduce((n,c)=>n+c.events.length,0),withoutPhone:candidates.filter(c=>!c.phoneCandidates.length).length,multiplePhones:candidates.filter(c=>c.phoneCandidates.length>1).length,phoneConflicts:candidates.filter(c=>c.flags.includes('telefone_em_outro_candidato')).length,possibleNonClient:candidates.filter(c=>c.flags.includes('possivel_evento_sem_cliente')).length},limitations:['Prévia: nenhum cadastro ou agendamento foi criado.','Título, origem, unidade e telefone exigem conferência humana.','Evento confirmado no Google não comprova serviço realizado ou pagamento.','Nenhum valor financeiro, recorrência ou permissão de contato é inferido.','Agrupamento exige mesmo telefone único, título e endereço; ainda requer revisão.'],candidates};
}
return {prepareReview,phones,phone,classify};
});
