-- ============================================================================
-- CRM Relacionamento Assescont — Migração inicial (só back-end)
-- 0001_init.sql
--
-- Escopo: apenas guardar no banco tudo que o app grava, SEM alterar o front.
-- O app continua salvando todo o estado como um único JSON (o objeto DATA, que
-- ele grava no localStorage). Aqui guardamos esse mesmo JSON numa única tabela.
-- ============================================================================

create extension if not exists pgcrypto;

-- Estado do CRM: um documento único, compartilhado pela equipe.
create table if not exists public.crm_state (
  id         text primary key,          -- usamos 'default'
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Atualiza updated_at automaticamente a cada gravação.
create or replace function public.crm_state_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_state_touch on public.crm_state;
create trigger trg_crm_state_touch
  before update on public.crm_state
  for each row execute function public.crm_state_touch();

-- ============================ ACESSO (RLS) =================================
-- IMPORTANTE — leia com atenção:
-- Como o front NÃO foi alterado, ele mantém a tela de login original (que é
-- apenas visual/client-side) e NÃO faz login no banco. Portanto o acesso ao
-- banco é feito com a chave anônima (anon). A política abaixo libera leitura e
-- escrita para o papel `anon`.
--
-- Consequência de segurança: quem tiver a URL do site e ler o JavaScript (onde
-- fica a anon key) consegue ler/escrever os dados. A tela de login do app não
-- protege o banco. Isso atende ao pedido de "não mexer no front"; se um dia
-- quiser segurança real (login de verdade por usuário), será preciso ajustar o
-- front para autenticar no Supabase — é só avisar.
--
-- Mitigação simples possível: manter a URL do projeto/anon key restritas e, se
-- necessário, adicionar restrição por rede/domínio no painel do Supabase.
alter table public.crm_state enable row level security;

drop policy if exists crm_state_anon_all on public.crm_state;
create policy crm_state_anon_all on public.crm_state
  for all
  to anon, authenticated
  using (true)
  with check (true);
