/* ============================================================================
 * backend-sync.js — Back-end do CRM (Supabase): autenticação + armazenamento.
 *
 * O app (index.html) continua praticamente igual ao original. As ÚNICAS
 * mudanças no front são na TELA DE LOGIN (agora e-mail/senha via Supabase Auth).
 * Toda a lógica de negócio, telas e cálculos permanecem intocados.
 *
 * Fluxo:
 *  - Login por e-mail/senha (Supabase Auth). Sem sessão, não há acesso aos dados.
 *  - Após autenticar, baixa o estado do banco e entrega ao app.
 *  - A cada gravação do app, envia o estado ao banco (autenticado).
 *
 * O acesso ao banco usa o token do usuário logado -> a política RLS
 * "authenticated" protege os dados (anônimo não lê nada).
 * ==========================================================================*/
(function () {
  'use strict';

  /* ===== Configuração do SEU projeto Supabase ===== */
  var SUPABASE_URL      = 'https://ptinbolxxnphpsodlnyd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_rUF9NhYZZZfxqvY5Gaht9A_79CDHO7L';

  var CRM_KEY  = 'assescont_crm_data_v2';   // chave que o app usa no localStorage
  var STATE_ID = 'default';                 // um estado compartilhado pela equipe

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[backend-sync] Biblioteca supabase-js não carregada. Verifique o <script> do CDN.');
    return;
  }

  var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  /* ---------------- Gravação (debounce) ---------------- */
  var _timer = null, _last = null, _sending = false, _again = false;

  function scheduleSave() { if (_timer) clearTimeout(_timer); _timer = setTimeout(saveNow, 700); }

  async function saveNow() {
    _timer = null;
    if (_sending) { _again = true; return; }
    _sending = true;
    try {
      var raw = (_last != null) ? _last : (localStorage.getItem(CRM_KEY) || '{}');
      var payload = { id: STATE_ID, data: JSON.parse(raw) };
      var res = await _sb.from('crm_state').upsert(payload);
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
    window.crmBackend.email = (user && user.email) ? user.email : null;
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

    try { sessionStorage.setItem('assescont_user', window.crmBackend.email || 'usuário'); } catch (_) {}
    var gate = document.getElementById('gate'); if (gate) gate.classList.add('hidden');
    var badge = document.getElementById('user-badge'); if (badge) badge.textContent = window.crmBackend.email || '';

    // Re-renderiza já com os dados vindos do banco.
    try { if (typeof switchView === 'function') switchView('dashboard'); } catch (_) {}
    try { if (typeof checkLembretes === 'function') checkLembretes(); } catch (_) {}
  }

  /* ---------------- API usada pela tela de login (index.html) ---------------- */
  window.crmBackend = {
    email: null,

    // Login por e-mail/senha. Retorna {ok:true} ou {ok:false, message}.
    signIn: async function (email, password) {
      try {
        var res = await _sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) return { ok: false, message: 'E-mail ou senha incorretos.' };
        await startSession(res.data.user);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: 'Falha ao conectar. Verifique sua internet.' };
      }
    },

    signOut: async function () {
      try { await _sb.auth.signOut(); } catch (_) {}
      try { sessionStorage.removeItem('assescont_user'); } catch (_) {}
      location.reload();
    },

    // Se já houver sessão salva (usuário voltou), entra direto.
    initSession: async function () {
      try {
        var res = await _sb.auth.getSession();
        if (res.data && res.data.session) await startSession(res.data.session.user);
      } catch (_) {}
    }
  };
})();
