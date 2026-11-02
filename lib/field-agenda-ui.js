/* Staging read-only integration; never uses legacy agenda/cache as fallback. */
(()=>{
'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev')return;
const host=document.querySelector('#home');if(!host||!window.SCFieldAgenda)return;
const panel=document.createElement('details');panel.className='card';panel.id='fieldAgendaPanel';
panel.innerHTML=`<summary>Agenda de campo por acesso — testes</summary>
 <p>Consulta de leitura por perfil, unidade e parceiro. Sem valores ou pagamentos. Esta consulta ainda não substitui a agenda principal.</p>
 <div class="grid grid2"><label>De<input id="fieldAgendaStart" type="date"></label><label>Até<input id="fieldAgendaEnd" type="date"></label></div>
 <label>Unidade<select id="fieldAgendaUnit"><option value="">Todas as autorizadas</option><option value="RS">RS</option><option value="SC">SC</option></select></label>
 <button type="button" id="fieldAgendaLoad">Consultar agenda por acesso</button>
 <p id="fieldAgendaStatus" role="status"></p><div id="fieldAgendaRows"></div>`;
host.append(panel);
const el=id=>document.getElementById(id);let generation=0;
function clear(){generation++;el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='';el('fieldAgendaLoad').disabled=false;panel.open=false;}
window.SCFieldAgendaUI={clear};
for(const id of ['fieldAgendaStart','fieldAgendaEnd','fieldAgendaUnit'])el(id).onchange=()=>{generation++;el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='Filtros alterados. Consulte novamente.';el('fieldAgendaLoad').disabled=false;};
window.addEventListener('storage',clear);
const today=new Date();const localDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
el('fieldAgendaStart').value=localDate;el('fieldAgendaEnd').value=localDate;
el('fieldAgendaLoad').onclick=async()=>{
 const gen=++generation;el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='Consultando…';el('fieldAgendaLoad').disabled=true;
 const input={start:el('fieldAgendaStart').value,end:el('fieldAgendaEnd').value,unit:el('fieldAgendaUnit').value||null};
 try{
  if(!navigator.onLine||!currentTech()?.cloud)throw Error('Entre na nuvem e conecte à internet para consultar.');
  const guard=captureVistoriaOperationGuard();
  const check=()=>{guard();if(gen!==generation)throw Error('Sessão ou filtros alterados.');};
  await ensureVistoriaSession();check();
  const rows=await window.SCFieldAgenda.read({url:cloudConfig().url,headers:crmHistoryCloudHeaders(),fetch:window.fetch.bind(window),check,input});check();
  const fragment=document.createDocumentFragment();
  for(const row of rows){
   const card=document.createElement('div');card.className='section';
   for(const text of [row.cliente||'Cliente não informado',`${row.data} · ${(row.hora||'').slice(0,5)} · ${row.unidade}`,row.status,row.cidade,row.endereco,row.telefone,row.tecnico]){
    if(!text)continue;const line=document.createElement('p');line.textContent=text;card.append(line);
   }
   fragment.append(card);
  }
  el('fieldAgendaRows').replaceChildren(fragment);el('fieldAgendaStatus').textContent=rows.length+' agendamento(s) autorizado(s) no período. Nenhuma alteração realizada.';
 }catch(error){if(gen===generation){el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent=error.message;}}
 finally{if(gen===generation)el('fieldAgendaLoad').disabled=false;}
};
})();
