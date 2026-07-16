-- ============================================================================
-- 0003_user_login.sql — Login por tabela "user" (em vez do Supabase Auth)
--
-- Cria a tabela public."user" com senhas em hash bcrypt e uma função de
-- verificação (verify_login) que NÃO expõe os hashes. O front chama essa função
-- via RPC para autenticar.
--
-- Observação de segurança: como não há mais sessão do Supabase Auth, o acesso à
-- tabela de dados (crm_state) volta a ser pela chave pública (anon). O login
-- pela tabela "user" protege a interface, não o banco em si.
--
-- Rode este arquivo no SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;   -- para crypt()/gen_salt() (bcrypt)

-- ----- Tabela de usuários do login -----
-- "user" é palavra reservada no Postgres, por isso fica sempre entre aspas.
create table if not exists public."user" (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  senha_hash text not null,
  nome       text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS ligado e SEM políticas: ninguém lê/escreve a tabela diretamente (nem anon,
-- nem authenticated). Só as funções SECURITY DEFINER abaixo a acessam.
alter table public."user" enable row level security;

-- ----- Verificação de login (não expõe os hashes) -----
create or replace function public.verify_login(p_email text, p_senha text)
returns table (id uuid, email text, nome text)
language sql
security definer
set search_path = public, extensions
as $$
  select u.id, u.email, u.nome
  from public."user" u
  where lower(u.email) = lower(p_email)
    and u.ativo = true
    and u.senha_hash = crypt(p_senha, u.senha_hash);
$$;

-- O front (chave anon) pode chamar apenas esta função para autenticar.
grant execute on function public.verify_login(text, text) to anon, authenticated;

-- ----- Criar/atualizar usuário (uso administrativo, no SQL Editor) -----
-- Ex.: select public.set_user('fulano@assescont.com.br', 'senhaForte', 'Fulano');
create or replace function public.set_user(p_email text, p_senha text, p_nome text default null)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  insert into public."user"(email, senha_hash, nome)
  values (lower(p_email), crypt(p_senha, gen_salt('bf')), p_nome)
  on conflict (email) do update
    set senha_hash = crypt(p_senha, gen_salt('bf')),
        nome       = coalesce(excluded.nome, public."user".nome),
        ativo      = true;
$$;

-- IMPORTANTE: set_user NÃO é liberada para anon (senão qualquer um criaria login).
-- Rode-a apenas aqui no SQL Editor (role postgres).
revoke all on function public.set_user(text, text, text) from anon, authenticated, public;

-- ----- Acesso ao crm_state volta a ser pela chave pública -----
-- (Removido o "só authenticated" do 0002, pois não há mais sessão do Supabase Auth.)
drop policy if exists crm_state_authenticated_all on public.crm_state;
drop policy if exists crm_state_anon_all on public.crm_state;
create policy crm_state_anon_all on public.crm_state
  for all to anon, authenticated
  using (true) with check (true);

-- ============================================================================
-- DEPOIS de rodar este arquivo, crie o primeiro usuário (troque e-mail/senha):
--   select public.set_user('automacao@assescont.com.br', 'TROQUE_ESTA_SENHA', 'Admin');
-- ============================================================================
