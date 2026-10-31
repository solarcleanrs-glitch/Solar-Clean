(function(root){
'use strict';
// Staging review only: explicit selection, exact source identity, existing durable RPC journal.
function mount(host,services){
 const box=document.createElement('section');host.append(box);
 let entries=[],targets=[],ready=false,running=false,epoch=0,page=0,query='',locked=false;
 function el(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
 const heading=el('h3','Revisão em lote — testes',box);
 el('p','Confira os cadastros abaixo e marque somente os revisados. Agrupamentos sugeridos exigem telefone, título e endereço iguais. Nome ou telefone sozinho não associa pessoas. Nenhuma agenda, cobrança ou mensagem será criada.',box);
 const search=el('input',undefined,box);search.type='search';search.placeholder='Pesquisar nome, telefone ou endereço';search.setAttribute('aria-label','Pesquisar revisão em lote');
 const info=el('p','Carregue o arquivo e verifique o acesso acima.',box),list=el('div',undefined,box),nav=el('div',undefined,box);
 const prev=el('button','Anterior',nav),next=el('button','Próximos 15',nav),send=el('button','Importar cadastros marcados',box);for(const b of [prev,next,send])b.type='button';
 const message=el('p','',box);message.setAttribute('role','status');
 function update(){send.disabled=running||!ready||!entries.some(e=>e.checked&&e.state!=='done');search.disabled=running||locked;prev.disabled=running||page===0;next.disabled=running||(page+1)*15>=filtered().length;}
 function filtered(){const q=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return entries.filter(e=>!q||JSON.stringify(e.candidate).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));}
 function input(parent,label,value,change){const l=el('label',label,parent),n=el('input',undefined,l);n.value=value;n.disabled=running||locked;n.oninput=()=>{change(n.value);};return n;}
 function render(){list.replaceChildren();const found=filtered();info.textContent=entries.length+' cadastros sugeridos · '+entries.reduce((n,e)=>n+e.candidate.events.length,0)+' eventos · '+entries.filter(e=>e.checked).length+' marcados · '+entries.filter(e=>e.state==='done').length+' confirmados. Página '+(page+1)+' de '+Math.max(1,Math.ceil(found.length/15));
 for(const e of found.slice(page*15,page*15+15)){
  const card=el('fieldset',undefined,list);el('legend',e.fields.cliente||'Sem nome',card);
  const details=el('details',undefined,card);el('summary','Conferir '+e.candidate.events.length+' evento(s) original(is)',details);
  for(const event of e.candidate.events)el('pre',[event.start||'Data não informada',event.summary,event.location,event.description,'Referência: '+event.sourceKey].filter(Boolean).join('\n'),details).style.whiteSpace='pre-wrap';
  const same=targets.filter(t=>(e.fields.telefone&&t.telefone===e.fields.telefone)||t.cliente.trim().toLowerCase()===e.fields.cliente.trim().toLowerCase());
  el('p',same.length?'Atenção: há cadastro existente com nome ou telefone igual. Confira o destino.':e.candidate.flags.includes('telefone_em_outro_candidato')?'Atenção: telefone também aparece em outro candidato. Confira a identidade.':'Confira pessoa, endereço, unidade e origem.',card);
  const mode=el('select',undefined,el('label','Destino ',card));for(const [v,t]of [['new','Novo cadastro'],...targets.map(t=>[t.importedClientId,'Vincular: '+t.cliente+' · '+t.telefone+' · '+t.unidade])]){const o=el('option',t,mode);o.value=v;}mode.value=e.target||'new';mode.disabled=running||locked;mode.onchange=()=>{e.target=mode.value;e.checked=false;if(e.target!=='new'){const t=targets.find(t=>t.importedClientId===e.target);e.fields={cliente:t.cliente,telefone:t.telefone,cidade:t.cidade,endereco:t.endereco,unidade:t.unidade,origem:t.origem,parceiro_id:t.parceiroId};}else e.fields=suggestions(e.candidate);render();};
  for(const [key,label]of [['cliente','Nome '],['telefone','Telefone (+55...) '],['cidade','Cidade '],['endereco','Endereço ']]){const n=input(card,label,e.fields[key],v=>{e.fields[key]=v;e.checked=false;ack.checked=false;update();});n.disabled=n.disabled||e.target!=='new';}
  for(const [key,label,options]of [['unidade','Unidade ',[['','Selecione'],['RS','RS'],['SC','SC']]],['origin','Origem ',services.origins()]]){const n=el('select',undefined,el('label',label,card));for(const [v,t]of options){const o=el('option',t,n);o.value=v;}n.value=key==='origin'?(e.fields.origem==='parceiro'?'parceiro:'+e.fields.parceiro_id:e.fields.origem):e.fields.unidade;n.disabled=running||locked||e.target!=='new';n.onchange=()=>{if(key==='origin'){e.fields.origem=n.value.startsWith('parceiro:')?'parceiro':n.value;e.fields.parceiro_id=n.value.startsWith('parceiro:')?n.value.slice(9):null;}else e.fields.unidade=n.value;e.checked=false;ack.checked=false;update();};}
  const label=el('label','Conferi os dados, os eventos e possíveis duplicidades deste cadastro. ',card),ack=el('input',undefined,label);ack.type='checkbox';ack.checked=e.checked;ack.disabled=running||locked||e.state==='done';ack.onchange=()=>{e.checked=ack.checked;update();};el('p',e.state==='done'?'Confirmado no banco de testes.':e.error||'',card);
 }update();}
 function suggestions(c){return {cliente:c.suggestedName,telefone:c.phoneCandidates.length===1?c.phoneCandidates[0]:'',cidade:'',endereco:c.addressSuggestion,unidade:c.unitSuggestion||'',origem:c.originSuggestion==='Particular'?'particular':'',parceiro_id:null};}
 search.oninput=()=>{query=search.value;page=0;render();};prev.onclick=()=>{if(!running&&page>0){page--;render();}};next.onclick=()=>{if(!running&&(page+1)*15<filtered().length){page++;render();}};
 send.onclick=async()=>{
  if(running||!ready)return;const turn=epoch,chosen=entries.filter(e=>e.checked&&e.state!=='done');if(!chosen.length)return;
  try{
   // Validate and freeze every selected request before the first network write.
   const ids=new Set(),people=new Set();for(const e of chosen){if(e.target!=='new')continue;const key=e.fields.telefone||[e.fields.cliente.trim().toLowerCase(),e.fields.endereco.trim().toLowerCase()].join('|');if(people.has(key)||targets.some(t=>(e.fields.telefone&&t.telefone===e.fields.telefone)||t.cliente.trim().toLowerCase()===e.fields.cliente.trim().toLowerCase()))throw Error('Possível cliente repetido. Confira os eventos e escolha um cadastro existente, ou revise esse caso individualmente.');people.add(key);}for(const e of chosen){if(!locked||!e.requests)e.requests=services.plan(e.candidate,{confirmed:true,targetMode:e.target==='new'?'new':'existing',clientId:e.target==='new'?e.id:e.target,fields:e.fields});for(const r of e.requests){const key=r.params.p_agenda+':'+r.params.p_evento;if(ids.has(key))throw Error('Evento repetido no lote.');ids.add(key);}}
  }catch(err){message.textContent='Nenhum envio iniciado: '+err.message;return;}
  running=true;locked=true;services.busy(true);render();message.textContent='Importando somente os cadastros marcados…';
  let failed=false;
  try{for(const e of chosen){for(let i=e.completed||0;i<e.requests.length;i++){await services.run(e.requests[i],()=>{if(turn!==epoch)throw Error('Conta ou arquivo mudou.');});if(turn!==epoch)return;e.completed=i+1;}e.state='done';e.error='';if(e.target==='new'&&!targets.some(t=>t.importedClientId===e.requests[0].params.p_cliente_id)){const f=e.requests[0].params.p_cadastro;targets.push({...f,parceiroId:f.parceiro_id,importedClientId:e.requests[0].params.p_cliente_id});}render();}}
  catch(err){failed=true;const pending=chosen.find(e=>e.state!=='done');if(pending)pending.error=err.message;message.textContent='Lote interrompido: '+err.message+' Os confirmados foram preservados. Use o mesmo botão para retomar; não recadastre.';}
  finally{running=false;services.busy(false);if(turn===epoch){if(!failed){locked=false;message.textContent='Lote concluído. '+chosen.length+' cadastro(s) confirmado(s), sem agenda ou cobrança.';for(const e of entries)if(e.state==='done')e.checked=false;}render();try{await services.refresh();}catch{message.textContent+=' Reabra o CRM para atualizar a lista.';}}}
 };
 return {load(candidates){epoch++;ready=false;locked=false;entries=candidates.map(candidate=>({candidate,id:crypto.randomUUID(),target:'new',fields:suggestions(candidate),checked:false,state:'review'}));page=0;query='';search.value='';message.textContent='';render();},access(value,clients){ready=value;targets=clients||[];render();},clear(){epoch++;ready=false;locked=false;entries=[];targets=[];message.textContent='';render();}};
}
root.SCClientHistoryBatch={mount};
})(window);
