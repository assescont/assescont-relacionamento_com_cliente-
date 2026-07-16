/* ============================================================================
 * backend-sync.js — Back-end do CRM (Supabase): login por tabela + armazenamento.
 *
 * Login: NÃO usa Supabase Auth. Autentica pela tabela public."user" através da
 * função verify_login (senhas em bcrypt; os hashes não são expostos ao front).
 * A "sessão" é um registro simples no localStorage do navegador.
 *
 * Dados: o app continua gravando tudo no localStorage; aqui interceptamos e
 * sincronizamos com a tabela crm_state (via chave pública).
 *
 * O único ponto do front que mudou é a tela de login (e-mail/senha).
 * ==========================================================================*/
(function () {
  'use strict';

  /* ===== Configuração do SEU projeto Supabase ===== */
  var SUPABASE_URL      = 'https://ptinbolxxnphpsodlnyd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_rUF9NhYZZZfxqvY5Gaht9A_79CDHO7L';

  var CRM_KEY    = 'assescont_crm_data_v2';   // chave do app no localStorage
  var STATE_ID   = 'default';                 // estado compartilhado pela equipe
  var LOGIN_KEY  = 'assescont_login';         // "sessão" local (usuário logado)

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[backend-sync] Biblioteca supabase-js não carregada. Verifique o <script> do CDN.');
    return;
  }

  var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ---------------- Gravação (debounce) ---------------- */
  var _timer = null, _last = null, _sending = false, _again = false;

  function scheduleSave() { if (_timer) clearTimeout(_timer); _timer = setTimeout(saveNow, 700); }

  async function saveNow() {
    _timer = null;
    if (_sending) { _again = true; return; }
    _sending = true;
    try {
      var raw = (_last != null) ? _last : (localStorage.getItem(CRM_KEY) || '{}');
      var res = await _sb.from('crm_state').upsert({ id: STATE_ID, data: JSON.parse(raw) });
      if (res.error) throw res.error;
    } catch (e) {
      console.error('[backend-sync] Falha ao salvar no banco:', e);
      try { showToast('⚠️ Falha ao salvar no servidor. Suas mudanças ficaram no navegador; vou tentar de novo.'); } catch (_) {}
    } finally {
      _sending = false;
      if (_again) { _again = false; scheduleSave(); }
    }
  }

  // Intercepta as gravações do app (salvar/editar/excluir/importar) -> banco.
  var _origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (key === CRM_KEY) { _last = value; scheduleSave(); }
  };

  /* ---------------- Carregamento + aplicação no app ---------------- */
  async function loadBlob() {
    var res = await _sb.from('crm_state').select('data').eq('id', STATE_ID).maybeSingle();
    if (res.error) throw res.error;
    var d = res.data && res.data.data;
    return (d && Object.keys(d).length) ? d : null;
  }

  function applyBlob(blob) {
    if (!blob || typeof DATA === 'undefined') return;
    Object.keys(DATA).forEach(function (k) { if (Array.isArray(blob[k])) DATA[k] = blob[k]; });
  }

  // Depois de autenticar: carrega os dados, atualiza a UI e renderiza.
  async function startSession(user) {
    window.crmBackend.email = (user && user.email) || null;
    var nomeExibicao = (user && (user.nome || user.email)) || 'usuário';
    try {
      var blob = await loadBlob();
      if (blob) {
        applyBlob(blob);
      } else {
        // Banco vazio: migração única do que já existir no navegador.
        _last = localStorage.getItem(CRM_KEY);
        if (_last && _last !== '{}') await saveNow();
      }
    } catch (e) {
      alert('Não consegui carregar os dados do servidor. Verifique sua conexão.\n\nDetalhe: ' + (e.message || e));
    }

    try { sessionStorage.setItem('assescont_user', nomeExibicao); } catch (_) {}
    var gate = document.getElementById('gate'); if (gate) gate.classList.add('hidden');
    var badge = document.getElementById('user-badge'); if (badge) badge.textContent = nomeExibicao;

    try { if (typeof switchView === 'function') switchView('dashboard'); } catch (_) {}
    try { if (typeof checkLembretes === 'function') checkLembretes(); } catch (_) {}
  }

  /* ---------------- API usada pela tela de login (index.html) ---------------- */
  window.crmBackend = {
    email: null,

    // Login por e-mail/senha, conferido na tabela "user" (função verify_login).
    signIn: async function (email, password) {
      try {
        var res = await _sb.rpc('verify_login', { p_email: email, p_senha: password });
        if (res.error) return { ok: false, message: 'Não foi possível verificar o login.' };
        var user = (res.data && res.data.length) ? res.data[0] : null;
        if (!user) return { ok: false, message: 'E-mail ou senha incorretos.' };
        try { localStorage.setItem(LOGIN_KEY, JSON.stringify({ email: user.email, nome: user.nome })); } catch (_) {}
        await startSession(user);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: 'Falha ao conectar. Verifique sua internet.' };
      }
    },

    signOut: function () {
      try { localStorage.removeItem(LOGIN_KEY); } catch (_) {}
      try { sessionStorage.removeItem('assescont_user'); } catch (_) {}
      location.reload();
    },

    // Se já houver "sessão" local (usuário logou antes neste navegador), entra direto.
    initSession: async function () {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null'); } catch (_) {}
      if (saved && saved.email) await startSession(saved);
    }
  };
})();
