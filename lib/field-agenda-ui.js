/* Staging scoped integration; never uses legacy agenda/cache as fallback. */
(()=>{
'use strict';
if(location.hostname!=='solar-clean-testes-crm.pages.dev'&&!location.hostname.endsWith('.solar-clean-testes-crm.pages.dev'))return;
const host=document.querySelector('#fieldAgendaScreen');if(!host||!window.SCFieldAgenda)return;
const panel=document.createElement('details');panel.className='card';panel.id='fieldAgendaPanel';
panel.innerHTML=`<summary>Agenda e relatórios por acesso — testes</summary>
 <p>Consulta por perfil, unidade e parceiro. Técnicos autorizados podem avançar o atendimento com conexão. Gestão de cadastro e valores permanece separada.</p>
 <div class="grid grid2"><label>De<input id="fieldAgendaStart" type="date"></label><label>Até<input id="fieldAgendaEnd" type="date"></label></div>
 <label>Unidade<select id="fieldAgendaUnit"><option value="">Todas as autorizadas</option><option value="RS">RS</option><option value="SC">SC</option></select></label>
 <button type="button" id="fieldAgendaLoad">Consultar agenda por acesso</button>
 <p id="fieldAgendaStatus" role="status"></p><div id="fieldAgendaRows"></div>
 <h3>Relatórios técnicos</h3><p>Consulte pelo mesmo período e unidade. Leitura sem pagamentos, observações internas ou assinaturas.</p>
 <button type="button" id="fieldReportsLoad">Consultar relatórios por acesso</button>
 <p id="fieldReportsStatus" role="status"></p><div id="fieldReportsRows"></div><div id="fieldReportDetail"></div>
 <div id="fieldClientsSection"><h3>Clientes importados por acesso</h3><p>Consulta por unidade, nome, telefone ou cidade. Cadastro importado não comprova atendimento ou pagamento.</p>
 <label for="fieldClientsSearch">Pesquisar clientes importados</label><input id="fieldClientsSearch" maxlength="100">
 <button type="button" id="fieldClientsLoad">Consultar clientes por acesso</button>
 <p id="fieldClientsStatus" role="status"></p><div id="fieldClientsRows"></div></div>`;
host.append(panel);
const el=id=>document.getElementById(id);let generation=0;const photoURLs=new Set(),contactEditors=new Set(),statusEditors=new Set();
function clearStatusEditors(){for(const item of statusEditors){item.box.replaceChildren();item.button.disabled=false;}statusEditors.clear();}
function clearReports(){for(const url of photoURLs)URL.revokeObjectURL(url);photoURLs.clear();el('fieldReportsRows').replaceChildren();el('fieldReportDetail').replaceChildren();el('fieldReportsStatus').textContent='';el('fieldReportsLoad').disabled=false;}
function clearClients(){for(const box of contactEditors)box.replaceChildren();contactEditors.clear();el('fieldClientsRows').replaceChildren();el('fieldClientsStatus').textContent='';el('fieldClientsLoad').disabled=false;}
function begin(){generation++;clearStatusEditors();el('fieldAgendaLoad').disabled=false;el('fieldReportsLoad').disabled=false;el('fieldClientsLoad').disabled=false;return generation;}
function clear(){generation++;clearStatusEditors();clearReports();clearClients();el('fieldClientsSearch').value='';el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='';el('fieldAgendaLoad').disabled=false;panel.open=false;}
function open(){panel.open=true;show('fieldAgendaScreen');}
window.SCFieldAgendaUI={clear,open};
// Only the test app/project uses this entry. Never fall back to legacy data on failure.
const entry=el('agendaBtn'),legacyEntry=entry?.onclick;
if(entry)entry.onclick=()=>{
 if(cloudConfig().url==='https://zzphucuiqhzrilrddxnf.supabase.co'){open();return;}
 return legacyEntry?.();
};
if(el('homeFromFieldAgenda'))el('homeFromFieldAgenda').onclick=()=>show('home');
if(el('legacyAgendaFromField'))el('legacyAgendaFromField').onclick=async()=>{
 const gen=begin(),button=el('legacyAgendaFromField');button.disabled=true;
 el('fieldAgendaStatus').textContent='Conferindo acesso à gestão…';
 try{
  const ctx=await reportContext(gen);
  if(!await window.SCFieldAgenda.canContact(ctx))throw Error('Gestão da agenda disponível somente ao gestor autorizado.');
  ctx.check();await legacyEntry?.();ctx.check();clear();
 }catch(error){if(gen===generation)el('fieldAgendaStatus').textContent=error.message;}
 finally{button.disabled=false;}
};
for(const id of ['fieldAgendaStart','fieldAgendaEnd','fieldAgendaUnit'])el(id).onchange=()=>{generation++;clearStatusEditors();clearReports();clearClients();el('fieldAgendaRows').replaceChildren();el('fieldAgendaStatus').textContent='Filtros alterados. Consulte novamente.';el('fieldAgendaLoad').disabled=false;};
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
  const ctx={url:cloudConfig().url,headers:crmHistoryCloudHeaders(),fetch:window.fetch.bind(window),check,input};
  const rows=await window.SCFieldAgenda.read(ctx);check();
  let mayAdvance=false,permissionNote='';
  try{mayAdvance=await window.SCFieldAgenda.canAdvanceStatus(ctx);check();}
  catch(error){check();permissionNote=' Atualização de atendimento indisponível; consulte novamente.';}
  const fragment=document.createDocumentFragment();
  for(const row of rows){
   const card=document.createElement('div');card.className='section';
   let statusLine;
   for(const [index,text]of [row.cliente||'Cliente não informado',`${row.data} · ${(row.hora||'').slice(0,5)} · ${row.unidade}`,row.status,row.cidade,row.endereco,row.telefone,row.tecnico].entries()){
    if(!text&&index!==2)continue;const line=document.createElement('p');line.textContent=text||'Status não informado';card.append(line);if(index===2)statusLine=line;
   }
   if(mayAdvance){const button=document.createElement('button');button.type='button';button.textContent='Atualizar atendimento';button.onclick=()=>void openAgendaStatus(row,card,statusLine,button);card.append(button);}
   if(window.SCFieldInspectionUI?.technical()){const button=document.createElement('button');button.type='button';button.textContent='Iniciar vistoria';button.onclick=async()=>{try{await window.SCFieldInspectionUI.start(row);}catch(error){el('fieldAgendaStatus').textContent=error.message;}};card.append(button);}
   fragment.append(card);
  }
  el('fieldAgendaRows').replaceChildren(fragment);el('fieldAgendaStatus').textContent=rows.length+' agendamento(s) autorizado(s) no período.'+permissionNote;
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
async function openAgendaStatus(row,card,statusLine,button){
 const gen=begin(),box=document.createElement('div');box.className='section';card.append(box);button.disabled=true;statusEditors.add({box,button});
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Conferindo situação atual…';box.append(message);
 try{
  const ctx=await reportContext(gen),snapshot=await window.SCFieldAgenda.agendaStatus(ctx,row.id);ctx.check();
  statusLine.textContent=snapshot.status;
  if(!snapshot.proximo_status){message.textContent='Situação atual: '+snapshot.status+'. Não há próximo avanço disponível.';button.disabled=false;return;}
  const intent=window.SCFieldAgenda.statusIntent(row.id,snapshot.revision,snapshot.proximo_status,crypto.randomUUID());
  message.textContent='Situação atual: '+snapshot.status;
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Confirmar: '+snapshot.proximo_status;box.append(confirm);
  confirm.onclick=async()=>{
   confirm.disabled=true;
   try{
    ctx.check();const result=await window.SCFieldAgenda.advanceStatus(ctx,intent);ctx.check();
    statusLine.textContent=result.estado_atual.status;
    message.textContent='Avanço confirmado. Situação atual: '+result.estado_atual.status;
    button.disabled=false;
   }catch(error){if(gen===generation){message.textContent=error.message+' Se a resposta se perdeu, repita esta confirmação; se o atendimento mudou, consulte a agenda novamente.';confirm.textContent='Repetir confirmação: '+snapshot.proximo_status;confirm.disabled=false;}}
  };
 }catch(error){if(gen===generation){message.textContent=error.message;button.disabled=false;}}
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
  for(const row of rows){const button=document.createElement('button');button.type='button';button.textContent=(row.cliente||'Cliente não informado')+' · '+new Date(row.created_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+(row.unidade||'Sem classificação');button.onclick=()=>void openReport(row.client_uuid);el('fieldReportsRows').append(button);if(window.SCFieldInspectionUI?.technical()){const edit=document.createElement('button');edit.type='button';edit.textContent='Editar vistoria / gerar PDF';edit.onclick=async()=>{try{await window.SCFieldInspectionUI.edit(row.client_uuid);}catch(error){el('fieldReportsStatus').textContent=error.message;}};el('fieldReportsRows').append(edit);}}
  el('fieldReportsStatus').textContent=rows.length+' relatório(s) autorizado(s) no período.';
 }catch(error){if(gen===generation)el('fieldReportsStatus').textContent=error.message;}
 finally{if(gen===generation)el('fieldReportsLoad').disabled=false;}
};
el('fieldClientsLoad').onclick=async()=>{
 const gen=begin();clearClients();clearReports();el('fieldClientsLoad').disabled=true;el('fieldClientsStatus').textContent='Consultando clientes…';
 try{
  const ctx=await reportContext(gen);ctx.input.search=el('fieldClientsSearch').value;
  const rows=await window.SCFieldAgenda.clients(ctx);ctx.check();
  let mayContact=false,contactStatus='';try{mayContact=await window.SCFieldAgenda.canContact(ctx);ctx.check();}catch(error){ctx.check();contactStatus=' Não foi possível conferir a permissão de registro de contatos. Atualize a consulta.';}
  for(const row of rows){const card=document.createElement('div');card.className='section';
   for(const value of [row.cliente,row.telefone,row.cidade,row.endereco,row.unidade,{particular:'Particular Solar Clean',parceiro:'Parceiro',nao_informada:'Origem em conferência'}[row.origem]]){
    if(!value)continue;const line=document.createElement('p');line.textContent=value;card.append(line);
   }
   if(mayContact){const edit=document.createElement('button');edit.type='button';edit.textContent='Editar cadastro e status — gestor';edit.onclick=()=>void openClientEdit(row,card);card.append(edit);}
   if(mayContact){const action=document.createElement('button');action.type='button';action.textContent='Histórico e contato — gestor';action.onclick=()=>void openContact(row,card);card.append(action);}
   el('fieldClientsRows').append(card);
  }
  el('fieldClientsStatus').textContent=rows.length+' cadastro(s) importado(s) autorizado(s).'+(mayContact?' Registro de contatos disponível ao gestor.':' Somente consulta.')+contactStatus;
 }catch(error){if(gen===generation)el('fieldClientsStatus').textContent=error.message;}
 finally{if(gen===generation)el('fieldClientsLoad').disabled=false;}
};
async function openContact(client,card){
 const gen=begin();clearReports();for(const previous of contactEditors)previous.replaceChildren();contactEditors.clear();
 const box=document.createElement('div');card.append(box);contactEditors.add(box);
 const status=document.createElement('p');status.setAttribute('role','status');box.append(status);
 try{
  const ctx=await reportContext(gen);if(!await window.SCFieldAgenda.canContact(ctx))throw Error('Registro de contato restrito ao gestor ativo.');ctx.check();
  const title=document.createElement('h4');title.textContent='Contato com '+client.cliente;box.append(title);
  function field(labelText,tag,id){const label=document.createElement('label'),span=document.createElement('span'),input=document.createElement(tag);span.textContent=labelText;input.id=id;label.append(span,input);box.append(label);return input;}
  const outcome=field('Resultado do contato','select','fieldContactOutcome');
  for(const value of window.SCFieldAgenda.outcomes){const option=document.createElement('option');option.value=value;option.textContent=value;outcome.append(option);}outcome.value=window.SCFieldAgenda.outcomes[0];
  const note=field('Observação interna do contato','textarea','fieldContactNote');note.maxLength=2000;
  const followup=field('Retorno previsto (opcional)','input','fieldContactFollowup');followup.type='date';
  const save=document.createElement('button');save.type='button';save.textContent='Salvar contato';save.id='fieldContactSave';box.append(save);
  const history=document.createElement('div');box.append(history);
  async function refreshHistory(){
   const rows=await window.SCFieldAgenda.contacts(ctx,client.id);ctx.check();history.replaceChildren();
   for(const row of rows){const line=document.createElement('p');line.textContent=new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+row.resultado+(row.retorno?' · Retorno: '+row.retorno:'')+(row.observacao?' · '+row.observacao:'');history.append(line);}
   if(!rows.length){const line=document.createElement('p');line.textContent='Sem contatos registrados para este cliente.';history.append(line);}
  }
  let intent=null,busy=false,confirmed=false;
  save.onclick=async()=>{
   if(busy||confirmed)return;busy=true;save.disabled=true;
   try{
    ctx.check();
    if(!intent)intent=window.SCFieldAgenda.contactIntent({client:client.id,outcome:outcome.value,note:note.value,followup:followup.value},crypto.randomUUID());
    outcome.disabled=note.disabled=followup.disabled=true;
    await window.SCFieldAgenda.recordContact(ctx,intent);ctx.check();confirmed=true;status.textContent='Contato confirmado. Nenhuma agenda, cobrança ou mensagem criada.';
    try{await refreshHistory();}catch(error){ctx.check();status.textContent='Contato confirmado. Não foi possível atualizar o histórico agora.';}
   }catch(error){if(gen===generation){status.textContent=intent?'Não foi possível confirmar esta tentativa. Confira o histórico antes de criar outro contato. Tentar novamente usa os mesmos dados. '+error.message:error.message;save.textContent=intent?'Tentar novamente o mesmo contato':'Salvar contato';}}
   finally{busy=false;if(gen===generation)save.disabled=confirmed;}
  };
  const reload=document.createElement('button');reload.type='button';reload.textContent='Atualizar histórico';reload.onclick=async()=>{try{await refreshHistory();}catch(error){if(gen===generation)status.textContent=error.message;}};box.append(reload);
  await refreshHistory();ctx.check();
 }catch(error){if(gen===generation)status.textContent=error.message;}
}
async function openClientEdit(client,card){
 const gen=begin();clearReports();for(const previous of contactEditors)previous.replaceChildren();contactEditors.clear();
 const box=document.createElement('div');card.append(box);contactEditors.add(box);
 const status=document.createElement('p');status.setAttribute('role','status');box.append(status);
 try{
  const ctx=await reportContext(gen),snapshot=await window.SCFieldAgenda.clientEdit(ctx,client.id);ctx.check();
  const title=document.createElement('h4');title.textContent='Editar cadastro de '+snapshot.cliente;box.append(title);
  const notice=document.createElement('p');notice.textContent='Unidade, origem e vínculos permanecem preservados. Esta edição não muda o CRM antigo nem cria agenda, cobrança ou mensagem.';box.append(notice);
  const fields={};
  for(const [key,labelText,max] of [['cliente','Nome',200],['telefone','Telefone (+55...)',14],['cidade','Cidade',200],['endereco','Endereço',1000],['status_comercial','Status comercial',null]]){
   const label=document.createElement('label'),span=document.createElement('span'),input=document.createElement(key==='status_comercial'?'select':'input');
   span.textContent=labelText;input.id='fieldEdit_'+key;label.append(span,input);box.append(label);fields[key]=input;
   if(max)input.maxLength=max;
   if(key==='status_comercial')for(const value of window.SCFieldAgenda.clientStatuses){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
   input.value=snapshot[key];
  }
  const save=document.createElement('button');save.type='button';save.id='fieldClientEditSave';save.textContent='Salvar cadastro revisado';box.append(save);
  const history=document.createElement('div');box.append(history);
  async function refreshHistory(){
   const rows=await window.SCFieldAgenda.clientEdits(ctx,client.id);ctx.check();history.replaceChildren();
   const labels={cliente:'Nome',telefone:'Telefone',cidade:'Cidade',endereco:'Endereço',status_comercial:'Status comercial'};
   for(const row of rows){const line=document.createElement('p');line.textContent=new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · Revisão '+row.depois.revision+' · '+Object.keys(labels).filter(k=>row.antes[k]!==row.depois[k]).map(k=>labels[k]+': '+row.antes[k]+' → '+row.depois[k]).join('; ');history.append(line);}
   if(!rows.length){const line=document.createElement('p');line.textContent='Sem edições registradas.';history.append(line);}
  }
  let intent=null,busy=false,confirmed=false;
  save.onclick=async()=>{
   if(busy||confirmed)return;busy=true;save.disabled=true;
   try{
    ctx.check();
    if(!intent)intent=window.SCFieldAgenda.editIntent(client.id,snapshot.revision,Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value])),crypto.randomUUID());
    for(const input of Object.values(fields))input.disabled=true;
    await window.SCFieldAgenda.saveClientEdit(ctx,intent);ctx.check();confirmed=true;
    status.textContent='Edição confirmada. Consulte os clientes novamente para exibir o cadastro atual.';
    try{await refreshHistory();}catch(error){ctx.check();status.textContent+=' Histórico indisponível neste momento.';}
   }catch(error){if(gen===generation){status.textContent=error.message+(intent?' Se houve conflito, consulte novamente antes de editar. Em resposta incerta, repetir usa os mesmos dados.':'');save.textContent=intent?'Repetir a mesma edição':'Salvar cadastro revisado';}}
   finally{busy=false;if(gen===generation)save.disabled=confirmed;}
  };
  const reload=document.createElement('button');reload.type='button';reload.textContent='Atualizar histórico de edições';reload.onclick=async()=>{try{await refreshHistory();}catch(error){if(gen===generation)status.textContent=error.message;}};box.append(reload);
  await refreshHistory();ctx.check();
 }catch(error){if(gen===generation)status.textContent=error.message;}
}

})();
