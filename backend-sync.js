/* ============================================================================
 * backend-sync.js — Back-end relacional do CRM (Supabase, schema "crm").
 *
 * Login: tabela public."user" (função verify_login, bcrypt).
 * Dados: cada seção do app vira uma tabela em crm.* .
 *   - No login: carrega todas as tabelas e monta o objeto DATA (snake->camel).
 *   - Ao salvar (persist): compara DATA com o último estado carregado e envia
 *     só o que mudou, POR REGISTRO (upsert dos novos/alterados, delete dos
 *     removidos). Campos calculados não são gravados (não estão no mapa).
 *
 * "Controle Pessoal" (acessos): fica só no navegador, nunca vai ao banco.
 * ==========================================================================*/
(function () {
  'use strict';

  var SUPABASE_URL      = 'https://ptinbolxxnphpsodlnyd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_rUF9NhYZZZfxqvY5Gaht9A_79CDHO7L';
  var CRM_KEY   = 'assescont_crm_data_v2';   // cache local do app
  var LOGIN_KEY = 'assescont_login';
  var LOCAL_ONLY = ['acessos'];              // nunca sincroniza (senhas)

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[backend-sync] supabase-js não carregou.'); return;
  }
  var _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY).schema('crm');
  var _auth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // rpc no schema public

  /* ---------------- Mapa de campos por seção ----------------
     Cada entrada: { table, map: {campoCamel: 'coluna_snake'}, num:[], int:[], date:[], json:[], bool:[] }
     Só colunas PERSISTIDAS entram no map (campos calculados ficam de fora). */
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
      map:{ id:'id', clienteId:'cliente_id', tipo:'tipo', data:'data', assunto:'assunto', observacoes:'observacoes' },
      date:['data'] },

    onb: { table:'onb',
      map:{ id:'id', clienteId:'cliente_id', procuracoes:'procuracoes', documentacao:'documentacao', openBank:'open_bank',
        certificado:'certificado', configuracaoNFs:'configuracao_nfs', observacoes:'observacoes' } },

    oportunidades: { table:'oportunidades',
      map:{ id:'id', clienteId:'cliente_id', oportunidade:'oportunidade', origem:'origem', data:'data',
        valorEstimado:'valor_estimado', responsavel:'responsavel', status:'status' },
      date:['data'] },

    certificados: { table:'certificados',
      map:{ id:'id', clienteId:'cliente_id', bancos:'bancos', certificados:'certificados',
        vencimentoCertificado:'vencimento_certificado', nfSaida:'nf_saida' },
      date:['vencimentoCertificado'] },

    rentabilidade: { table:'rentabilidade',
      map:{ id:'id', clienteId:'cliente_id', competencia:'competencia', faturamentoAtual:'faturamento_atual',
        funcionariosContratado:'funcionarios_contratado', funcionariosAtual:'funcionarios_atual',
        horasOrcadas:'horas_orcadas', horasGastas:'horas_gastas', observacoes:'observacoes', idExterno:'id_externo' },
      int:['funcionariosContratado','funcionariosAtual'], num:['faturamentoAtual','horasOrcadas','horasGastas'] },

    parceiros: { table:'parceiros',
      map:{ id:'id', parceiro:'parceiro', areaAtuacao:'area_atuacao', clienteComum:'cliente_comum_id',
        qtdIndicacoes:'qtd_indicacoes', acordos:'acordos' },
      int:['qtdIndicacoes'] },

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

  // registro camelCase (app) -> linha snake_case (banco)
  function toRow(sec, rec){
    var s=SCHEMA[sec], row={};
    var numS=new Set(s.num||[]), intS=new Set(s.int||[]), dateS=new Set(s.date||[]), jsonS=new Set(s.json||[]), boolS=new Set(s.bool||[]);
    for(var camel in s.map){
      if(!(camel in rec)) continue;
      var col=s.map[camel], v=rec[camel];
      if(numS.has(camel)) v=toNum(v);
      else if(intS.has(camel)) v=toInt(v);
      else if(dateS.has(camel)) v=toDate(v);
      else if(boolS.has(camel)) v=!!v;
      else if(jsonS.has(camel)) v=(v===undefined?null:v);
      else { if(v==='') v=null; } // texto vazio -> null
      row[col]=v;
    }
    return row;
  }
  // linha snake_case (banco) -> registro camelCase (app)
  function fromRow(sec, row){
    var s=SCHEMA[sec], inv=invMap(s), jsonS=new Set(s.json||[]), boolS=new Set(s.bool||[]), rec={};
    for(var col in row){
      var camel=inv[col]; if(!camel) continue;
      var v=row[col];
      if(boolS.has(camel)) rec[camel]=!!v;
      else if(jsonS.has(camel)) rec[camel]=(v==null?null:v);
      else rec[camel]=(v==null?'':v);  // app espera strings; null -> ''
    }
    return rec;
  }

  /* ---------------- Carregamento ---------------- */
  async function loadAll(){
    var sections=Object.keys(SCHEMA);
    await Promise.all(sections.map(async function(sec){
      var res=await _db.from(SCHEMA[sec].table).select('*');
      if(res.error) throw new Error(sec+': '+res.error.message);
      if(Array.isArray(DATA[sec])) DATA[sec]=(res.data||[]).map(function(r){ return fromRow(sec,r); });
    }));
  }

  /* ---------------- Snapshot / diff ---------------- */
  var _snap={};
  function takeSnapshot(){
    _snap={};
    for(var sec in SCHEMA){
      _snap[sec]={};
      (DATA[sec]||[]).forEach(function(r){ if(r&&r.id) _snap[sec][r.id]=JSON.stringify(toRow(sec,r)); });
    }
  }
  async function syncDiff(){
    for(var sec in SCHEMA){
      var s=SCHEMA[sec], atual=DATA[sec]||[], snap=_snap[sec]||{};
      var vistos={}, upserts=[];
      atual.forEach(function(r){
        if(!r||!r.id) return;
        vistos[r.id]=true;
        var row=toRow(sec,r), key=JSON.stringify(row);
        if(snap[r.id]!==key) upserts.push(row);
      });
      var deletes=Object.keys(snap).filter(function(id){ return !vistos[id]; });
      if(upserts.length){
        var up=await _db.from(s.table).upsert(upserts,{onConflict:'id'});
        if(up.error) throw new Error('upsert '+sec+': '+up.error.message);
      }
      if(deletes.length){
        var del=await _db.from(s.table).delete().in('id', deletes);
        if(del.error) throw new Error('delete '+sec+': '+del.error.message);
      }
    }
    takeSnapshot();
  }

  /* ---------------- Gravação (debounce) ---------------- */
  var _timer=null, _saving=false, _again=false, _ready=false;
  function scheduleSave(){ if(_timer) clearTimeout(_timer); _timer=setTimeout(saveNow,700); }
  async function saveNow(){
    _timer=null; if(!_ready) return;
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
    try{
      await loadAll();
      takeSnapshot();
      _ready=true;
    }catch(e){
      alert('Não consegui carregar os dados do servidor.\n\n'+(e.message||e)); return;
    }
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
        var res=await _auth.rpc('verify_login',{p_email:email,p_senha:password});
        if(res.error) return {ok:false,message:'Não foi possível verificar o login.'};
        var u=(res.data&&res.data.length)?res.data[0]:null;
        if(!u) return {ok:false,message:'E-mail ou senha incorretos.'};
        try{ localStorage.setItem(LOGIN_KEY, JSON.stringify({email:u.email,nome:u.nome})); }catch(_){}
        await startSession(u); return {ok:true};
      }catch(e){ return {ok:false,message:'Falha ao conectar.'}; }
    },
    signOut: function(){ try{localStorage.removeItem(LOGIN_KEY);}catch(_){}; try{sessionStorage.removeItem('assescont_user');}catch(_){}; location.reload(); },
    initSession: async function(){
      var saved=null; try{ saved=JSON.parse(localStorage.getItem(LOGIN_KEY)||'null'); }catch(_){}
      if(saved&&saved.email) await startSession(saved);
    }
  };
})();
