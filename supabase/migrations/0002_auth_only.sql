-- ============================================================================
-- 0002_auth_only.sql — Exigir usuário autenticado (login real)
--
-- Agora o app faz login de verdade (Supabase Auth). O acesso ao banco passa a
-- usar o token do usuário logado. Esta migração REMOVE o acesso anônimo e libera
-- apenas para usuários AUTENTICADOS — assim os dados ficam de fato protegidos.
--
-- Rode este arquivo no SQL Editor DEPOIS do 0001_init.sql.
-- ============================================================================

-- Remove a política antiga (que permitia anônimo).
drop policy if exists crm_state_anon_all on public.crm_state;

-- Garante RLS ativo.
alter table public.crm_state enable row level security;

-- Acesso total apenas para usuários autenticados (login por e-mail/senha).
drop policy if exists crm_state_authenticated_all on public.crm_state;
create policy crm_state_authenticated_all on public.crm_state
  for all
  to authenticated
  using (true)
  with check (true);
