-- ============================================================================
-- crm_0004_mover_login_para_crm.sql
-- Move a tabela de login (user) e as funções verify_login/set_user de public
-- para o schema crm, para o CRM ficar 100% isolado no schema crm (o public
-- passa a conter só o outro sistema — onboarding). Preserva usuários e hashes.
-- ============================================================================
alter table public."user" set schema crm;

drop function if exists public.verify_login(text, text);
drop function if exists public.set_user(text, text, text);

create or replace function crm.verify_login(p_email text, p_senha text)
returns table (id uuid, email text, nome text)
language sql security definer set search_path = crm, public, extensions
as $$
  select u.id, u.email, u.nome
  from crm."user" u
  where lower(u.email) = lower(p_email)
    and u.ativo = true
    and u.senha_hash = crypt(p_senha, u.senha_hash);
$$;
grant execute on function crm.verify_login(text, text) to anon, authenticated;

create or replace function crm.set_user(p_email text, p_senha text, p_nome text default null)
returns void
language sql security definer set search_path = crm, public, extensions
as $$
  insert into crm."user"(email, senha_hash, nome)
  values (lower(p_email), crypt(p_senha, gen_salt('bf')), p_nome)
  on conflict (email) do update
    set senha_hash = crypt(p_senha, gen_salt('bf')),
        nome = coalesce(excluded.nome, crm."user".nome),
        ativo = true;
$$;
revoke all on function crm.set_user(text, text, text) from anon, authenticated, public;

notify pgrst, 'reload schema';

-- A partir daqui, criar/gerir usuários é: select crm.set_user('email','senha','Nome');
