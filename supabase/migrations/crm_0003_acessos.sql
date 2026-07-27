-- ============================================================================
-- crm_0003_acessos.sql — Aba "Controle Pessoal" (sistemas/usuários/senhas)
--
-- usuario e senha são gravados CIFRADOS (AES-GCM no navegador; chave derivada da
-- senha de login do usuário, nunca gravada). O banco nunca vê essas duas em claro.
-- owner = e-mail do usuário logado; separação por usuário é feita no app + cifra.
-- ============================================================================
create table crm.acessos (
  id text primary key,
  owner text,          -- e-mail do dono (login)
  sistema text,
  categoria text,
  link text,
  usuario text,        -- CIFRADO (v1:...)
  senha text,          -- CIFRADO (v1:...)
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index idx_crm_acessos_owner on crm.acessos(owner);

create trigger trg_acessos_updated before update on crm.acessos
  for each row execute function crm.set_updated_at();

alter table crm.acessos enable row level security;
create policy crm_all on crm.acessos for all to anon, authenticated using (true) with check (true);
grant all on crm.acessos to anon, authenticated;
notify pgrst, 'reload schema';
