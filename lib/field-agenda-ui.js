/* Staging read-only integration; never uses legacy agenda/cache as fallback. */
(()=>{
'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev')return;
const host=document.querySelector('#home');if(!host||!window.SCFieldAgenda)return;
const panel=document.createElement('details');panel.className='card';panel.id='fieldAgendaPanel';
panel.innerHTML=`<summary>Agenda e relatórios por acesso — testes</summary>
 <p>Consulta de leitura por perfil, unidade e parceiro. Sem valores ou pagamentos. Esta consulta ainda não substitui a agenda principal.</p>
 <div class="grid grid2"><label>De<input id="fieldAgendaStart" type="date"></label><label>Até<input id="fieldAgendaEnd" type="date"></label></div>
 <label>Unidade<select id="fieldAgendaUnit"><option value="">Todas as autorizadas</option><option value="RS">RS</option><option value="SC">SC</option></select></label>
 <button type="button" id="fieldAgendaLoad">Consultar agenda por acesso</button>
 <p id="fieldAgendaStatus" role="status"></p><div id="fieldAgendaRows"></div>
 <h3>Relatórios técnicos</h3><p>Consulte pelo mesmo período e unidade. Leitura sem pagamentos, observações internas ou assinaturas.</p>
 <button type="button" id="fieldReportsLoad">Consultar relatórios por acesso</button>
 <p id="fieldReportsStatus" role="status"></p><div id="fieldReportsRows"></div><div id="fieldReportDetail"></div>
 <h3>Clientes importados por acesso</h3><p>Consulta por unidade, nome, telefone ou cidade. Cadastro importado não comprova atendimento ou pagamento.</p>
 <label for="fieldClientsSearch">Pesquisar clientes importados</label><input id="fieldClientsSearch" maxlength="100">
 <button type="button" id="fieldClientsLoad">Consultar clientes por acesso</button>
 <p id="fieldClientsStatus" role="status"></p><div id="fieldClientsRows"></div>`;
host.append(panel);
const el=id=>document.getElementById(id);let generation=0;const photoURLs=new Set();
function clearReports(){for(const url of photoURLs)URL.revokeObjectURL(url);photoURLs.clear();el('fieldReportsRows').replaceChildren();el('fieldReportDetail').replaceChildren();el('fieldReportsStatus').textContent='';el('fieldReportsLoad').disabled=false;}
function clearClients(){el('fieldClientsRows').replaceChildren();el('fieldClientsStatus').textContent='';el('fieldClientsLoad').disabled=false;}
function begin(){generation++;el('fieldAgendaLoad').disabled=false;el('fieldReportsLoad').disabled=false;el('fieldClientsLoad').disabled=false;return generation;}
function clear(){generation++;clearReports();clearClients();el('fieldClientsSearch').value='';el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='';el('fieldAgendaLoad').disabled=false;panel.open=false;}
window.SCFieldAgendaUI={clear};
for(const id of ['fieldAgendaStart','fieldAgendaEnd','fieldAgendaUnit'])el(id).onchange=()=>{generation++;clearReports();clearClients();el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='Filtros alterados. Consulte novamente.';el('fieldAgendaLoad').disabled=false;};
el('fieldClientsSearch').oninput=()=>{begin();clearClients();clearReports();};
window.addEventListener('storage',clear);
const today=new Date();const localDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
el('fieldAgendaStart').value=localDate;el('fieldAgendaEnd').value=localDate;
el('fieldAgendaLoad').onclick=async()=>{
 const gen=begin();clearReports();el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='Consultando…';el('fieldAgendaLoad').disabled=true;
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
async function reportContext(gen){
 if(!navigator.onLine||!currentTech()?.cloud)throw Error('Entre na nuvem e conecte à internet para consultar.');
 const guard=captureVistoriaOperationGuard();const check=()=>{guard();if(gen!==generation)throw Error('Sessão ou filtros alterados.');};
 await ensureVistoriaSession();check();
 return {url:cloudConfig().url,headers:crmHistoryCloudHeaders(),fetch:window.fetch.bind(window),check,
 input:{start:el('fieldAgendaStart').value,end:el('fieldAgendaEnd').value,unit:el('fieldAgendaUnit').value||null}};
}
const reportLabels={cliente:'Cliente',telefone:'Telefone',cidade:'Cidade',endereco:'Endereço',placas:'Placas',pot_placa:'Potência por placa',marca_placa:'Marca das placas',marca_inv:'Inversor',modelo_inv:'Modelo do inversor',ano_inst:'Ano de instalação',telhado:'Instalação',sujeira:'Sujeira',estrutura:'Estrutura',dps:'DPS',qtd_dps:'Quantidade de DPS',modelo_dps:'Modelo de DPS',inv_status:'Estado do inversor',inv_internet:'Internet do inversor',erro_inv:'Erro do inversor',antes:'Geração antes',depois:'Geração depois',pct:'Variação',limpeza:'Limpeza',retorno:'Retorno recomendado',tecnico:'Técnico'};
async function openReport(owner){
 const gen=begin();for(const url of photoURLs)URL.revokeObjectURL(url);photoURLs.clear();el('fieldReportDetail').replaceChildren();el('fieldReportsStatus').textContent='Abrindo relatório…';
 try{
  const ctx=await reportContext(gen),report=await window.SCFieldAgenda.report(ctx,owner);ctx.check();
  const view=document.createElement('div');view.className='section';
  for(const [key,label] of Object.entries(reportLabels)){
   if(['antes','depois','pct'].includes(key)&&report.show_generation===false)continue;
   const value=report[key];if(value===null||value==='')continue;const line=document.createElement('p');line.textContent=label+': '+String(value);view.append(line);
  }
  for(const photo of report.media_manifest){
   const box=document.createElement('div'),button=document.createElement('button');button.type='button';button.textContent='Abrir foto: '+photo.category;box.append(button);view.append(box);
   button.onclick=async()=>{
    button.disabled=true;try{
     ctx.check();const blob=await window.SCFieldAgenda.photo(ctx,owner,photo);ctx.check();
     const url=URL.createObjectURL(blob);photoURLs.add(url);const image=document.createElement('img');image.alt=photo.category;image.src=url;image.style.maxWidth='100%';box.append(image);button.textContent='Foto carregada: '+photo.category;
    }catch(error){if(gen===generation){button.textContent=error.message;button.disabled=false;}}
   };
  }
  el('fieldReportDetail').append(view);el('fieldReportsStatus').textContent='Relatório técnico autorizado. Nenhuma alteração realizada.';
 }catch(error){if(gen===generation)el('fieldReportsStatus').textContent=error.message;}
}
el('fieldReportsLoad').onclick=async()=>{
 const gen=begin();clearReports();el('fieldReportsLoad').disabled=true;el('fieldReportsStatus').textContent='Consultando relatórios…';
 try{
  const ctx=await reportContext(gen),rows=await window.SCFieldAgenda.reports(ctx);ctx.check();
  for(const row of rows){const button=document.createElement('button');button.type='button';button.textContent=(row.cliente||'Cliente não informado')+' · '+new Date(row.created_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+(row.unidade||'Sem classificação');button.onclick=()=>void openReport(row.client_uuid);el('fieldReportsRows').append(button);}
  el('fieldReportsStatus').textContent=rows.length+' relatório(s) autorizado(s) no período.';
 }catch(error){if(gen===generation)el('fieldReportsStatus').textContent=error.message;}
 finally{if(gen===generation)el('fieldReportsLoad').disabled=false;}
};
el('fieldClientsLoad').onclick=async()=>{
 const gen=begin();clearClients();clearReports();el('fieldClientsLoad').disabled=true;el('fieldClientsStatus').textContent='Consultando clientes…';
 try{
  const ctx=await reportContext(gen);ctx.input.search=el('fieldClientsSearch').value;
  const rows=await window.SCFieldAgenda.clients(ctx);ctx.check();
  for(const row of rows){const card=document.createElement('div');card.className='section';
   for(const value of [row.cliente,row.telefone,row.cidade,row.endereco,row.unidade,{particular:'Particular Solar Clean',parceiro:'Parceiro',nao_informada:'Origem em conferência'}[row.origem]]){
    if(!value)continue;const line=document.createElement('p');line.textContent=value;card.append(line);
   }el('fieldClientsRows').append(card);
  }
  el('fieldClientsStatus').textContent=rows.length+' cadastro(s) importado(s) autorizado(s). Somente consulta.';
 }catch(error){if(gen===generation)el('fieldClientsStatus').textContent=error.message;}
 finally{if(gen===generation)el('fieldClientsLoad').disabled=false;}
};
})();
