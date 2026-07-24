-- ============================================================================
-- crm_0001_schema_inicial.sql — Schema relacional dedicado do CRM
--
-- Modelo relacional (schema "crm"), separado das tabelas de onboarding que já
-- existiam em public (clientes/contatos/pre_cadastros — outro sistema, intactas).
-- ids em text (preservam os ids do app). Aplicada via Supabase (apply_migration).
-- ============================================================================
create schema if not exists crm;

create or replace function crm.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table crm.clientes (
  id text primary key,
  cnpj text, razao_social text, grupo text, regime text, funcionarios integer,
  logradouro text, numero_endereco text, complemento text, bairro text, cep text, cidade text, estado text,
  cnae_principal text, responsavel_legal text, cpf_responsavel_legal text, email_responsavel_legal text,
  telefone_contato text, email_contato text, competencia_entrada text, competencia_saida text,
  data_assinatura_contrato date, data_aniversario date, proxima_renovacao date,
  numero_proposta text, numero_contrato text, status_cliente text, motivo_cancelamento text,
  honorario numeric(14,2), faturamento numeric(14,2), sistema_financeiro text,
  id_externo text, divisao_manual text, base_conhecimento text, origem_prospeccao text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_clientes_cnpj on crm.clientes(cnpj);
create index idx_crm_clientes_grupo on crm.clientes(grupo);
create index idx_crm_clientes_status on crm.clientes(status_cliente);

create table crm.comercial (
  id text primary key, cliente_id text references crm.clientes(id) on delete set null,
  numero_proposta integer, cnpj text, razao_social text, regime_tributario text, servico_contratado text,
  faturamento_anual numeric(14,2), filiais integer, grupo text, cnpjs_filiais jsonb default '[]'::jsonb, funcionarios integer,
  documentos text, sistema_financeiro text, competencia_entrada text, dia_vencimento text,
  socio_contratante text, cpf_socio_contratante text, email_socio_contratante text,
  data_envio_proposta date, prazo_retorno text, status_proposta text, data_ganho date,
  motivo_recusa text, canal text, honorario_enviado numeric(14,2), proposta_pdf jsonb, proposta_docx jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_comercial_cliente on crm.comercial(cliente_id);
create index idx_crm_comercial_status on crm.comercial(status_proposta);

create table crm.relacionamento (
  id text primary key, chave text unique, cliente_id text references crm.clientes(id) on delete set null,
  classificacao text, semaforo text, qtd_indicacoes_feitas integer, indice_manual numeric, alertas text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_relacionamento_cliente on crm.relacionamento(cliente_id);

create table crm.rnc (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  setor text, competencia text, descricao_erro text, data date, classificacao_erro text,
  multa text, valor_multa numeric(14,2), medida_corretiva text, medida_preventiva text, cliente_notificou text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_rnc_cliente on crm.rnc(cliente_id);

create table crm.demandas (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  demanda text, data_recebida date, prazo date, setor text, status text,
  recorrente text, periodo_recorrencia text, anexo jsonb, recorrencia_gerada boolean default false,
  conclusao_andamento text, origem_comercial_id text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_demandas_cliente on crm.demandas(cliente_id);

create table crm.agenda (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  periodicidade text, data_programada date, responsavel text, status text, observacoes text, historico_gerado_id text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_agenda_cliente on crm.agenda(cliente_id);

create table crm.historico (
  id text primary key, cliente_id text references crm.clientes(id) on delete cascade,
  tipo text, data date, assunto text, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz);
create index idx_crm_historico_cliente on crm.historico(cliente_id);

do $$ declare t text; begin
  foreach t in array array['clientes','comercial','relacionamento','rnc','demandas','agenda','historico'] loop
    execute format('create trigger trg_%1$s_updated before update on crm.%1$s for each row execute function crm.set_updated_at();', t);
    execute format('alter table crm.%I enable row level security;', t);
    execute format('create policy crm_all on crm.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop; end $$;
