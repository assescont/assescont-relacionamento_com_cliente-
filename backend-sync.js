/* ============================================================================
 * backend-sync.js — Back-end do CRM via GATEWAY (Supabase, schema "crm").
 *
 * Nenhum acesso direto às tabelas: todo dado passa por FUNÇÕES que exigem um
 * TOKEN DE SESSÃO emitido no login (crm.login / crm_fetch / crm_save). Assim a
 * chave pública sozinha não lê nada (as tabelas crm.* negam acesso direto).
 *
 * Login: tabela crm."user" (bcrypt) -> token de sessão (crm.sessions, validade 12h).
 * Controle Pessoal (crm.controle_pessoal): usuario/senha CIFRADOS no navegador
 * (AES-GCM, chave derivada da senha de login; nunca gravada). owner forçado no servidor.
 * ==========================================================================*/
(function () {
  'use strict';

  var SUPABASE_URL      = 'https://ptinbolxxnphpsodlnyd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_rUF9NhYZZZfxqvY5Gaht9A_79CDHO7L';
  var CRM_KEY   = 'assescont_crm_data_v2';
  var LOGIN_KEY = 'assescont_login';
  var VAULT_KEY = 'assescont_vault_k';

  /* ===== Webhook do n8n =====
     Cole aqui a URL do webhook do n8n (nó "Webhook", método POST). A cada alteração
     salva no banco, o app envia um POST com o que mudou. Deixe '' para desativar.
     Ex.: 'https://SEU-N8N/webhook/crm-assescont' */
  var N8N_WEBHOOK_URL = 'https://n8n.srv934741.hstgr.cloud/webhook/relacinamento-com-cliente';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[backend-sync] supabase-js não carregou.'); return;
  }
  var _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY).schema('crm');
  var _token = null;

  /* ---------------- Mapa de campos por seção (DATA <-> tabela crm) ---------------- */
  var SCHEMA = {
    clientes: { table:'clientes',
      map:{ id:'id', cnpj:'cnpj', razaoSocial:'razao_social', grupo:'grupo', regime:'regime', funcionarios:'funcionarios',
        logradouro:'logradouro', numeroEndereco:'numero_endereco', complemento:'complemento', bairro:'bairro', cep:'cep',
        cidade:'cidade', estado:'estado', cnaePrincipal:'cnae_principal', responsavelLegal:'responsavel_legal',
        cpfResponsavelLegal:'cpf_responsavel_legal', emailResponsavelLegal:'email_responsavel_legal',
        telefoneContato:'telefone_contato', emailContato:'email_contato', competenciaEntrada:'competencia_entrada',
        competenciaSaida:'competencia_saida', dataAssinaturaContrato:'data_assinatura_contrato', dataAniversario:'data_aniversario',
        proximaRenovacao:'proxima_renovacao', numeroProposta:'numero_proposta', numeroContrato:'numero_contrato',
        statusCliente:'status_cliente', motivoCancelamento:'motivo_cancelamento', honorario:'honorario', faturamento:'faturamento',
        sistemaFinanceiro:'sistema_financeiro', idExterno:'id_externo', divisaoManual:'divisao_manual', baseConhecimento:'base_conhecimento' },
      int:['funcionarios'], num:['honorario','faturamento'], date:['dataAssinaturaContrato','dataAniversario','proximaRenovacao'] },
    comercial: { table:'comercial',
      map:{ id:'id', clienteId:'cliente_id', _numeroProposta:'numero_proposta', cnpj:'cnpj', razaoSocial:'razao_social',
        regimeTributario:'regime_tributario', servicoContratado:'servico_contratado', faturamentoAnual:'faturamento_anual',
        filiais:'filiais', grupo:'grupo', cnpjsFiliais:'cnpjs_filiais', funcionarios:'funcionarios', documentos:'documentos',
        sistemaFinanceiro:'sistema_financeiro', competenciaEntrada:'competencia_entrada', diaVencimento:'dia_vencimento',
        socioContratante:'socio_contratante', cpfSocioContratante:'cpf_socio_contratante', emailSocioContratante:'email_socio_contratante',
        dataEnvioProposta:'data_envio_proposta', prazoRetorno:'prazo_retorno', statusProposta:'status_proposta', dataGanho:'data_ganho',
        motivoRecusa:'motivo_recusa', canal:'canal', honorarioEnviado:'honorario_enviado', propostaPdf:'proposta_pdf', propostaDocx:'proposta_docx' },
      int:['_numeroProposta','filiais','funcionarios'], num:['faturamentoAnual','honorarioEnviado'],
      date:['dataEnvioProposta','dataGanho'], json:['cnpjsFiliais','propostaPdf','propostaDocx'] },
    relacionamento: { table:'relacionamento',
      map:{ id:'id', chave:'chave', clienteId:'cliente_id', classificacao:'classificacao', semaforo:'semaforo',
        qtdIndicacoesFeitas:'qtd_indicacoes_feitas', indiceManual:'indice_manual', alertas:'alertas' },
      int:['qtdIndicacoesFeitas'], num:['indiceManual'] },
    rnc: { table:'rnc',
      map:{ id:'id', clienteId:'cliente_id', setor:'setor', competencia:'competencia', descricaoErro:'descricao_erro',
        data:'data', classificacaoErro:'classificacao_erro', multa:'multa', valorMulta:'valor_multa',
        medidaCorretiva:'medida_corretiva', medidaPreventiva:'medida_preventiva', clienteNotificou:'cliente_notificou' },
      num:['valorMulta'], date:['data'] },
    demandas: { table:'demandas',
      map:{ id:'id', clienteId:'cliente_id', demanda:'demanda', dataRecebida:'data_recebida', prazo:'prazo', setor:'setor',
        status:'status', recorrente:'recorrente', periodoRecorrencia:'periodo_recorrencia', anexo:'anexo',
        _recorrenciaGerada:'recorrencia_gerada', conclusaoAndamento:'conclusao_andamento', origemComercialId:'origem_comercial_id' },
      date:['dataRecebida','prazo'], json:['anexo'], bool:['_recorrenciaGerada'] },
    agenda: { table:'agenda',
      map:{ id:'id', clienteId:'cliente_id', periodicidade:'periodicidade', dataProgramada:'data_programada',
        responsavel:'responsavel', status:'status', observacoes:'observacoes', historicoGeradoId:'historico_gerado_id' },
      date:['dataProgramada'] },
    historico: { table:'historico',
      map:{ id:'id', clienteId:'cliente_id', tipo:'tipo', data:'data', assunto:'assunto', observacoes:'observacoes' }, date:['data'] },
    onb: { table:'onb',
      map:{ id:'id', clienteId:'cliente_id', procuracoes:'procuracoes', documentacao:'documentacao', openBank:'open_bank',
        certificado:'certificado', configuracaoNFs:'configuracao_nfs', observacoes:'observacoes' } },
    oportunidades: { table:'oportunidades',
      map:{ id:'id', clienteId:'cliente_id', oportunidade:'oportunidade', origem:'origem', data:'data',
        valorEstimado:'valor_estimado', responsavel:'responsavel', status:'status' }, date:['data'] },
    certificados: { table:'certificados',
      map:{ id:'id', clienteId:'cliente_id', bancos:'bancos', certificados:'certificados',
        vencimentoCertificado:'vencimento_certificado', nfSaida:'nf_saida',
        tipoProjeto:'tipo_projeto', status:'status', prazo:'prazo', observacoes:'observacoes' },
      date:['vencimentoCertificado','prazo'] },
    rentabilidade: { table:'rentabilidade',
      map:{ id:'id', clienteId:'cliente_id', competencia:'competencia', faturamentoAtual:'faturamento_atual',
        funcionariosContratado:'funcionarios_contratado', funcionariosAtual:'funcionarios_atual',
        horasOrcadas:'horas_orcadas', horasGastas:'horas_gastas', observacoes:'observacoes', idExterno:'id_externo' },
      int:['funcionariosContratado','funcionariosAtual'], num:['faturamentoAtual','horasOrcadas','horasGastas'] },
    parceiros: { table:'parceiros',
      map:{ id:'id', parceiro:'parceiro', areaAtuacao:'area_atuacao', clienteComum:'cliente_comum_id',
        qtdIndicacoes:'qtd_indicacoes', acordos:'acordos' }, int:['qtdIndicacoes'] },
    reajustes: { table:'reajustes',
      map:{ id:'id', clienteId:'cliente_id', data:'data', honorarioAnterior:'honorario_anterior',
        honorarioNovo:'honorario_novo', margemLucroPercentual:'margem_lucro_percentual', basesUtilizadas:'bases_utilizadas' },
      num:['honorarioAnterior','honorarioNovo','margemLucroPercentual'], date:['data'] },
    historicoHonorario: { table:'historico_honorario',
      map:{ id:'id', clienteId:'cliente_id', valorAnterior:'valor_anterior', valorNovo:'valor_novo', data:'data', origem:'origem' },
      num:['valorAnterior','valorNovo'], date:['data'] },
    historicoStatus: { table:'historico_status',
      map:{ id:'id', clienteId:'cliente_id', campo:'campo', valorAnterior:'valor_anterior', valorNovo:'valor_novo', data:'data' },
      date:['data'] }
  };

  function invMap(s){ var o={}; for(var k in s.map) o[s.map[k]]=k; return o; }
  function toNum(v){ if(v===''||v==null) return null; var n=Number(String(v).replace(',','.')); return isNaN(n)?null:n; }
  function toInt(v){ var n=toNum(v); return n==null?null:Math.trunc(n); }
  function toDate(v){ if(!v) return null; var s=String(v).slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null; }
  function toRow(sec, rec){
    var s=SCHEMA[sec], row={};
    var numS=new Set(s.num||[]), intS=new Set(s.int||[]), dateS=new Set(s.date||[]), jsonS=new Set(s.json||[]), boolS=new Set(s.bool||[]);
    for(var camel in s.map){
      if(!(camel in rec)) continue;
      var col=s.map[camel], v=rec[camel];
      if(numS.has(camel)) v=toNum(v); else if(intS.has(camel)) v=toInt(v); else if(dateS.has(camel)) v=toDate(v);
      else if(boolS.has(camel)) v=!!v; else if(jsonS.has(camel)) v=(v===undefined?null:v); else { if(v==='') v=null; }
      row[col]=v;
    }
    return row;
  }
  function fromRow(sec, row){
    var s=SCHEMA[sec], inv=invMap(s), jsonS=new Set(s.json||[]), boolS=new Set(s.bool||[]), rec={};
    for(var col in row){ var camel=inv[col]; if(!camel) continue; var v=row[col];
      if(boolS.has(camel)) rec[camel]=!!v; else if(jsonS.has(camel)) rec[camel]=(v==null?null:v); else rec[camel]=(v==null?'':v); }
    return rec;
  }

  /* ---------------- Criptografia (Controle Pessoal) ---------------- */
  var _vaultKey=null;
  async function deriveKey(password, salt){
    var enc=new TextEncoder();
    var base=await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt:enc.encode('assescont|'+(salt||'')), iterations:150000, hash:'SHA-256'},
      base, {name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
  }
  function b64e(b){ var s=''; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
  function b64d(str){ var raw=atob(str), b=new Uint8Array(raw.length); for(var i=0;i<raw.length;i++) b[i]=raw.charCodeAt(i); return b; }
  async function encStr(plain){
    if(!_vaultKey || plain==null || plain==='') return (plain==null?null:plain);
    var iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM', iv:iv}, _vaultKey, new TextEncoder().encode(String(plain)));
    var out=new Uint8Array(iv.length+ct.byteLength); out.set(iv,0); out.set(new Uint8Array(ct), iv.length);
    return 'v1:'+b64e(out);
  }
  async function decStr(data){
    if(!data) return ''; if(String(data).slice(0,3)!=='v1:') return data; if(!_vaultKey) return '🔒';
    try{ var b=b64d(String(data).slice(3)), iv=b.slice(0,12), ct=b.slice(12);
      return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM', iv:iv}, _vaultKey, ct)); }catch(e){ return '🔒'; }
  }
  async function storeVaultKey(){ try{ var raw=await crypto.subtle.exportKey('raw',_vaultKey); sessionStorage.setItem(VAULT_KEY, b64e(new Uint8Array(raw))); }catch(e){} }
  async function restoreVaultKey(){ try{ var b=sessionStorage.getItem(VAULT_KEY); if(!b){_vaultKey=null;return;} _vaultKey=await crypto.subtle.importKey('raw', b64d(b), {name:'AES-GCM'}, true, ['encrypt','decrypt']); }catch(e){ _vaultKey=null; } }

  /* ---------------- Carga (via crm_fetch) ---------------- */
  async function loadAll(){
    var res=await _db.rpc('crm_fetch', {p_token:_token});
    if(res.error) throw new Error('carga: '+res.error.message);
    var data=res.data||{};
    for(var sec in SCHEMA){
      var rows=data[SCHEMA[sec].table]||[];
      if(Array.isArray(DATA[sec])) DATA[sec]=rows.map(function(r){ return fromRow(sec,r); });
    }
    if(Array.isArray(DATA.acessos)){
      var arr=data['controle_pessoal']||[], out=[];
      for(var i=0;i<arr.length;i++){ var r=arr[i];
        out.push({ id:r.id, sistema:r.sistema||'', categoria:r.categoria||'', link:r.link||'',
          usuario:await decStr(r.usuario), senha:await decStr(r.senha), observacoes:r.observacoes||'' }); }
      DATA.acessos=out;
    }
  }

  /* ---------------- Snapshot + diff (via crm_save) ---------------- */
  var _snap={}, _snapAce={};
  function takeSnapshot(){
    _snap={}; for(var sec in SCHEMA){ _snap[sec]={}; (DATA[sec]||[]).forEach(function(r){ if(r&&r.id) _snap[sec][r.id]=JSON.stringify(toRow(sec,r)); }); }
    _snapAce={}; (DATA.acessos||[]).forEach(function(r){ if(r&&r.id) _snapAce[r.id]=JSON.stringify(r); });
  }
  async function syncDiff(){
    var changes={};
    for(var sec in SCHEMA){
      var s=SCHEMA[sec], atual=DATA[sec]||[], snap=_snap[sec]||{}, vistos={}, up=[];
      atual.forEach(function(r){ if(!r||!r.id) return; vistos[r.id]=true; var row=toRow(sec,r); if(snap[r.id]!==JSON.stringify(row)) up.push(row); });
      var del=Object.keys(snap).filter(function(id){ return !vistos[id]; });
      if(up.length||del.length) changes[s.table]={up:up, del:del};
    }
    // Controle Pessoal (cifra usuario/senha); só se o cofre estiver aberto
    if(_vaultKey){
      var atualA=DATA.acessos||[], vistosA={}, upA=[];
      for(var i=0;i<atualA.length;i++){ var r=atualA[i]; if(!r||!r.id) continue; vistosA[r.id]=true;
        if(_snapAce[r.id]!==JSON.stringify(r)) upA.push({ id:r.id, sistema:r.sistema||null, categoria:r.categoria||null, link:r.link||null,
          usuario:await encStr(r.usuario), senha:await encStr(r.senha), observacoes:r.observacoes||null }); }
      var delA=Object.keys(_snapAce).filter(function(id){ return !vistosA[id]; });
      if(upA.length||delA.length) changes['controle_pessoal']={up:upA, del:delA};
    }
    if(Object.keys(changes).length){
      var res=await _db.rpc('crm_save', {p_token:_token, p_changes:changes});
      if(res.error) throw new Error('gravação: '+res.error.message);
      notifyN8n(changes);   // avisa o n8n do que mudou (fire-and-forget)
    }
    takeSnapshot();
  }

  /* Envia ao webhook do n8n o que foi alterado. Fire-and-forget: não bloqueia nem
     quebra a gravação se falhar. NÃO envia o Controle Pessoal (dados pessoais). */
  function notifyN8n(changes){
    if(!N8N_WEBHOOK_URL) return;
    try{
      var payload={};
      for(var k in changes){ if(k!=='controle_pessoal') payload[k]=changes[k]; }
      if(!Object.keys(payload).length) return;
      fetch(N8N_WEBHOOK_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        keepalive:true,
        body: JSON.stringify({
          evento:'crm_alteracao',
          usuario: (window.crmBackend && window.crmBackend.email) || null,
          em: new Date().toISOString(),
          mudancas: payload
        })
      }).catch(function(){});
    }catch(e){}
  }

  /* ---------------- Debounce ---------------- */
  var _timer=null, _saving=false, _again=false, _ready=false;
  function scheduleSave(){ if(_timer) clearTimeout(_timer); _timer=setTimeout(saveNow,700); }
  async function saveNow(){
    _timer=null; if(!_ready||!_token) return;
    if(_saving){ _again=true; return; }
    _saving=true;
    try{ await syncDiff(); }
    catch(e){ console.error('[backend-sync]',e); try{ showToast('⚠️ Falha ao salvar no banco. Vou tentar de novo.'); }catch(_){} }
    finally{ _saving=false; if(_again){ _again=false; scheduleSave(); } }
  }
  var _origSet=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){ _origSet(k,v); if(k===CRM_KEY) scheduleSave(); };

  /* ---------------- Sessão ---------------- */
  async function startSession(user){
    window.crmBackend.email=(user&&user.email)||null;
    var nome=(user&&(user.nome||user.email))||'usuário';
    try{ await loadAll(); takeSnapshot(); _ready=true; }
    catch(e){ alert('Não consegui carregar os dados do servidor.\n\n'+(e.message||e)); return; }
    try{ sessionStorage.setItem('assescont_user', nome); }catch(_){}
    var g=document.getElementById('gate'); if(g) g.classList.add('hidden');
    var b=document.getElementById('user-badge'); if(b) b.textContent=nome;
    try{ if(typeof switchView==='function') switchView('dashboard'); }catch(_){}
    try{ if(typeof checkLembretes==='function') checkLembretes(); }catch(_){}
    try{ if(typeof checarLembreteBackup==='function') checarLembreteBackup(); }catch(_){}
  }

  window.crmBackend={
    email:null,
    signIn: async function(email,password){
      try{
        var res=await _db.rpc('login',{p_email:email,p_senha:password});
        if(res.error) return {ok:false,message:'Não foi possível verificar o login.'};
        var u=(res.data&&res.data.length)?res.data[0]:null;
        if(!u||!u.token) return {ok:false,message:'E-mail ou senha incorretos.'};
        _token=u.token;
        try{ _vaultKey=await deriveKey(password, (u.email||email).toLowerCase()); await storeVaultKey(); }catch(e){ _vaultKey=null; }
        try{ localStorage.setItem(LOGIN_KEY, JSON.stringify({email:u.email,nome:u.nome,token:u.token})); }catch(_){}
        await startSession(u); return {ok:true};
      }catch(e){ return {ok:false,message:'Falha ao conectar.'}; }
    },
    signOut: function(){ try{localStorage.removeItem(LOGIN_KEY);}catch(_){}; try{sessionStorage.removeItem('assescont_user');sessionStorage.removeItem(VAULT_KEY);}catch(_){}; location.reload(); },
    initSession: async function(){
      var saved=null; try{ saved=JSON.parse(localStorage.getItem(LOGIN_KEY)||'null'); }catch(_){}
      if(saved&&saved.email&&saved.token){ _token=saved.token; await restoreVaultKey(); await startSession(saved); }
    }
  };
})();
