/* ============================================================================
 * backend-sync.js — Adaptador de back-end (Supabase).
 *
 * É a ÚNICA parte nova. O app (index.html) continua EXATAMENTE igual ao original:
 * ele lê e grava tudo no localStorage, na chave "assescont_crm_data_v2".
 *
 * Este arquivo apenas "intercepta" essa leitura/gravação:
 *   - Na carga da página, busca os dados no banco e entrega ao app.
 *   - Quando o app grava (salvar/editar/excluir/importar), envia ao banco.
 *
 * Assim, tudo que tem input no front é guardado no banco, sem tocar no app.
 * Não usa nenhuma biblioteca externa — fala direto com a API REST do Supabase.
 * ==========================================================================*/
(function () {
  'use strict';

  /* ===== Configuração do SEU projeto Supabase (novo e dedicado) =====
     Painel do Supabase > Project Settings > API.
     A "anon key" é pública por design. NUNCA use aqui a "service_role key". */
  var SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
  var SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_ANON_KEY';

  var CRM_KEY  = 'assescont_crm_data_v2';   // a mesma chave que o app já usa
  var STATE_ID = 'default';                 // um estado único compartilhado
  var REST     = SUPABASE_URL + '/rest/v1/crm_state';

  var _origGet = localStorage.getItem.bind(localStorage);
  var _origSet = localStorage.setItem.bind(localStorage);
  var _cloudData = null;   // string JSON vinda do banco (ou null se vazio/offline)

  /* 1) Carga inicial a partir do banco — feita ANTES do app ler o localStorage.
     Usa requisição síncrona para o dado já estar pronto quando o app iniciar,
     sem precisar alterar o código do app. */
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', REST + '?id=eq.' + STATE_ID + '&select=data', false);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + SUPABASE_ANON_KEY);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      var arr = JSON.parse(xhr.responseText || '[]');
      if (arr.length && arr[0].data && Object.keys(arr[0].data).length) {
        _cloudData = JSON.stringify(arr[0].data);
      }
    } else {
      console.error('[backend-sync] Erro ao carregar do banco:', xhr.status, xhr.responseText);
    }
  } catch (e) {
    // Offline ou credenciais ausentes: o app usa o cache local do navegador.
    console.warn('[backend-sync] Sem conexão com o banco; usando cache local.', e);
  }

  /* 2) Leitura: para a chave do CRM, devolve o dado do banco (se houver).
     Se o banco estiver vazio, cai no localStorage real — assim os dados legados
     do navegador são carregados e a primeira gravação os "sobe" (migração). */
  localStorage.getItem = function (key) {
    if (key === CRM_KEY && _cloudData !== null) return _cloudData;
    return _origGet(key);
  };

  /* 3) Gravação: mantém o cache local e envia ao banco (com pequeno atraso). */
  var _timer = null, _last = null, _sending = false, _again = false;

  function push() {
    _timer = null;
    if (_sending) { _again = true; return; }
    if (SUPABASE_URL.indexOf('SEU-PROJETO') !== -1) {
      console.warn('[backend-sync] Configure SUPABASE_URL / SUPABASE_ANON_KEY.');
      return;
    }
    _sending = true;
    var payload;
    try { payload = { id: STATE_ID, data: JSON.parse(_last) }; }
    catch (e) { _sending = false; return; }

    fetch(REST, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t); });
    }).catch(function (e) {
      console.error('[backend-sync] Falha ao salvar no banco:', e);
    }).finally(function () {
      _sending = false;
      if (_again) { _again = false; _timer = setTimeout(push, 300); }
    });
  }

  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (key === CRM_KEY) {
      _last = value;
      if (_timer) clearTimeout(_timer);
      _timer = setTimeout(push, 700);
    }
  };
})();
