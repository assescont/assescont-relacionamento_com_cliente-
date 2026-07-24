-- ============================================================================
-- crm_0002_tabelas_restantes.sql — Demais entidades + exposição do schema na API
-- ============================================================================
create table crm.onb (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  procuracoes text, documentacao text, open_bank text, certificado text, configuracao_nfs text, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_onb_cliente on crm.onb(cliente_id);

create table crm.oportunidades (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  oportunidade text, origem text, data date, valor_estimado text, responsavel text, status text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_oport_cliente on crm.oportunidades(cliente_id);

create table crm.certificados (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  bancos text, certificados text, vencimento_certificado date, nf_saida text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_cert_cliente on crm.certificados(cliente_id);

create table crm.rentabilidade (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  competencia text, faturamento_atual numeric(14,2), funcionarios_contratado integer, funcionarios_atual integer,
  horas_orcadas numeric, horas_gastas numeric, observacoes text, id_externo text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_rent_cliente on crm.rentabilidade(cliente_id);

create table crm.parceiros (
  id text primary key, parceiro text, area_atuacao text,
  cliente_comum_id text references crm.clientes(id) on delete set null, qtd_indicacoes integer, acordos text,
  created_at timestamptz not null default now(), updated_at timestamptz);

create table crm.reajustes (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  data date, honorario_anterior numeric(14,2), honorario_novo numeric(14,2),
  margem_lucro_percentual numeric, bases_utilizadas text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_reaj_cliente on crm.reajustes(cliente_id);

create table crm.historico_honorario (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  valor_anterior numeric(14,2), valor_novo numeric(14,2), data date, origem text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_histhon_cliente on crm.historico_honorario(cliente_id);

create table crm.historico_status (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  campo text, valor_anterior text, valor_novo text, data date,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_histst_cliente on crm.historico_status(cliente_id);

do $$ declare t text; begin
  foreach t in array array['onb','oportunidades','certificados','rentabilidade','parceiros','reajustes','historico_honorario','historico_status'] loop
    execute format('create trigger trg_%1$s_updated before update on crm.%1$s for each row execute function crm.set_updated_at();', t);
    execute format('alter table crm.%I enable row level security;', t);
    execute format('create policy crm_all on crm.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop; end $$;

-- Expor o schema crm na API (PostgREST) + permissões
grant usage on schema crm to anon, authenticated;
grant all on all tables in schema crm to anon, authenticated;
alter default privileges in schema crm grant all on tables to anon, authenticated;
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, crm';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
