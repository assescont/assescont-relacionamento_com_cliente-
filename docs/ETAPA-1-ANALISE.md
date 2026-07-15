# Etapa 1 — Análise e mapeamento do CRM Assescont

> **Nota (escopo final):** após esta análise, o escopo foi ajustado para o mínimo —
> **armazenar os dados no banco, login de acesso e manter online, sem alterar o
> front-end.** O esquema relacional detalhado abaixo **não foi adotado** (exigiria
> reescrever o front); em vez dele, o estado é guardado como um documento JSON numa
> tabela `crm_state`. Veja o [`README.md`](../README.md). Este documento fica como
> mapeamento técnico do sistema e base caso um dia se queira evoluir para o modelo
> relacional.


> Fonte: `RELACIONAMENTO_ASSESCONT_-_07_2026_2.html` (arquivo único, ~3.296 linhas, 2,6 MB — a maior parte é o blob base64 dos modelos `.docx`).
> Persistência atual: `localStorage`, chave `assescont_crm_data_v2`, objeto global `DATA` serializado em JSON.
> **Nenhum código/schema foi escrito ou aplicado. Este documento é para validação.**

---

## 0. Ponto crítico de ambiente (bloqueia Etapas 2 e 4 como descritas)

O prompt pressupõe "o conector/integração do Supabase disponível no ambiente" e "a integração [da Vercel] disponível no ambiente". **Esses conectores não existem neste ambiente.** Verifiquei:

- A lista de ferramentas MCP disponíveis (n8n, Notion, um app de design, browser, registro de conectores, tarefas agendadas) — **nenhuma de Supabase ou Vercel**.
- O registro de conectores (`search_mcp_registry` com `supabase`, `postgres`, `vercel`, `deploy`) — **retornou vazio**.
- Autenticação de MCP nesta sessão é não-interativa (não consigo rodar OAuth aqui).

**Consequência:** eu não consigo, por conta própria, (a) listar projetos existentes na sua conta Supabase/Vercel, (b) criar os projetos novos, (c) aplicar migrações no banco, nem (d) publicar o deploy. Essas ações exigem que você as execute com as suas credenciais.

**O que eu consigo entregar 100%:** toda a engenharia — migrações SQL versionadas, front-end refatorado com a camada de dados, rotina de migração do `localStorage`, `README`, `vercel.json` e um passo a passo de CLI. Você roda os comandos (`supabase db push`, `vercel deploy`) autenticado nas suas contas. Isso preserva integralmente a **REGRA CRÍTICA** de isolamento: como os recursos são criados por você via CLI/painel, nada preexistente é tocado.

As opções de como proceder estão no fim deste documento.

---

## 1. Entidades e campos (objeto `DATA` + dicionário `SECTIONS`)

`clientes` é a **lista mestre**. As demais seções referenciam o cliente por `clienteId` (tipo `clientRef`). Há duas coleções internas sem aba própria: `historico` e `reajustes`.

Legenda de tipos de campo (do front-end): `text`, `number`, `currency`, `date`, `select`, `textarea`, `file`, `clientRef`, `computed`, `filiaisDetalhado`.

### 1.1 `clientes` (mestre)
| Campo (camelCase) | Tipo | Required | Observações |
|---|---|---|---|
| cnpj | text | ✅ | |
| razaoSocial | text | ✅ | |
| grupo | text | | agrupa matriz+filiais |
| regime | select | | Simples Nacional, Lucro Presumido, Lucro Real, MEI |
| funcionarios | number | | |
| logradouro | text | | |
| numeroEndereco | text | | |
| complemento | text | | |
| cidade | text | | puxada do CNPJ (BrasilAPI) |
| estado | text | | puxada do CNPJ |
| cnaePrincipal | text | | puxada do CNPJ |
| responsavelLegal | text | | |
| telefoneContato | text | | |
| emailContato | text | | |
| competenciaEntrada | text | | ex.: "07/2026" |
| dataAssinaturaContrato | date | | |
| numeroProposta | text | | nº textual (referência) |
| numeroContrato | text | | |
| **origemProspeccao** | **computed** | | derivado do Comercial — **não persistir** |
| statusCliente | select | | Ativo, Cancelado |
| competenciaSaida | text | | |
| motivoCancelamento | select | | Insatisfação, Financeiro |
| honorario | currency | | atualizado por reajustes |
| faturamento | currency | | |
| sistemaFinanceiro | text | | |
| dataAniversario | date | | |
| proximaRenovacao | date | | |
| baseConhecimento | textarea | | |

### 1.2 `comercial` (propostas)
| Campo | Tipo | Required | Observações |
|---|---|---|---|
| _numeroProposta | (interno) number | | sequência (base 2000, +1). É persistido. |
| numeroProposta | **computed** | | display "#N" — não persistir |
| cnpj | text | ✅ | |
| razaoSocial | text | ✅ | |
| regimeTributario | select | | Simples Nacional, Lucro Presumido, Lucro Real |
| servicoContratado | select | | Com folha de pagamento, Sem folha de pagamento |
| faturamentoAnual | currency | | entrada da planilha de cálculo |
| filiais | number | | |
| grupo | text | | obrigatório em runtime se filiais>0 |
| cnpjsFiliais | filiaisDetalhado | | array de `{cnpj}` |
| funcionarios | number | | |
| **honorarioCalculado** | **computed** | | motor de honorário — não persistir |
| **horasComparativo** | **computed** | | honorário ÷ 80 — não persistir |
| documentos | select | | Completos, Pendentes, Não iniciado |
| sistemaFinanceiro | text | | |
| competenciaEntrada | text | | |
| dataEnvioProposta | date | | |
| statusProposta | select | | Proposta enviada, Aceita, Pendente, Recusada |
| dataGanho | date | | auto-preenchida ao aceitar |
| **tempoConversao** | **computed** | | dataGanho − dataEnvioProposta — não persistir |
| motivoRecusa | textarea | | |
| canal | select | | Indicação, Site, Prospecção ativa, Rede social, Constituição, Outro |
| propostaPdf | file | | **→ Storage** |
| propostaDocx | file | | **→ Storage** |
| clienteId | clientRef | | **nulo até o aceite** (proposta pode existir sem cliente) |

### 1.3 `onb` (onboarding)
`clienteId`✅, procuracoes, documentacao, openBank, certificado, configuracaoNFs (todos select: Concluído/Pendente/Não iniciado), observacoes (textarea).

### 1.4 `demandas`
`clienteId`✅, demanda(text✅), dataRecebida(date), prazo(date), setor(select), status(select), recorrente(select Não/Sim), periodoRecorrencia(select), anexo(**file → Storage**). **Flag interna persistida:** `_recorrenciaGerada` (boolean, controla geração da próxima ocorrência).

### 1.5 `relacionamento` (Health Score)
Chaveado por **`chave`** (não por registro solto): `'grupo:<grupo>'` quando o cliente tem grupo, senão `'cliente:<clienteId>'`. Campos persistidos: `id`, `chave`, `clienteId`, classificacao(select A/B/C/D), semaforo(select Verde/Amarelo/Vermelho), qtdIndicacoesFeitas(number), indiceManual(number 0–10), alertas(textarea). Observação: `clienteId` aqui não está no `SECTIONS.fields` — é injetado por `getOrCreateRelacionamento`.

### 1.6 `oportunidades`
`clienteId`✅, oportunidade(text✅), origem(select), data(date), **valorEstimado(text — não é currency!)**, responsavel(text), status(select Identificada/Em andamento/Convertida/Perdida).

### 1.7 `agenda`
`clienteId`✅, periodicidade(select), dataProgramada(date), responsavel(text), status(select Programada/Realizada/Remarcada/Cancelada), observacoes(textarea).

### 1.8 `certificados`
`clienteId`✅, bancos(text), certificados(text), vencimentoCertificado(date), nfSaida(select Configurada/Pendente/Não se aplica).

### 1.9 `rentabilidade`
`clienteId`✅, competencia(text✅ ex "07/2026"), faturamentoAtual(currency), horasOrcadas(number), horasGastas(number), observacoes(textarea). **Computed (não persistir):** `faturamentoContratado` (faturamentoAnual do Comercial ÷12), `desvioFaturamento`, `desvio` (horas), `grupoCliente`.

### 1.10 `rnc`
`clienteId`✅, setor(select), data(date), classificacaoErro(select Leve/Moderado/Grave), multa(select Não / Sim - paga pela Assescont / Sim - paga pelo cliente), valorMulta(currency), medidaCorretiva(textarea), clienteNotificou(select Sim/Não), medidaPreventiva(textarea).

### 1.11 `parceiros`
parceiro(text✅), areaAtuacao(text), **clienteComum(clientRef — referência secundária, nula)**, qtdIndicacoes(number), acordos(textarea).

### 1.12 `historico` (log interno — sem aba)
`id`, clienteId, tipo(Reunião/Ligação/WhatsApp/E-mail/Visita/Elogio/Reclamação/Solicitação), data, assunto, observacoes.

### 1.13 `reajustes` (log interno — sem aba)
`id`, clienteId, data, honorarioAnterior, honorarioNovo, margemLucroPercentual, basesUtilizadas. Ao registrar, atualiza `cliente.honorario`.

---

## 2. Relacionamentos entre entidades

- **`clientes` (1) → (N) satélites** via `clienteId`: onb, demandas, oportunidades, agenda, certificados, rentabilidade, rnc, historico, reajustes, relacionamento.
- **`comercial.clienteId`**: nulo enquanto a proposta está "Aguardando aceite"; preenchido no aceite (`processarAceiteComercial` cria/vincula o cliente + cria ONB).
- **`parceiros.clienteComum`**: referência secundária, opcional.
- **`relacionamento`**: 1 linha por **grupo** (ou por cliente sem grupo), via `chave`.
- Regras de negócio no aceite: cria matriz + filiais em `clientes`, cria `onb` para cada, copia funcionarios/sistemaFinanceiro/regime/honorário. Salvar em `clientes` com `grupo`+`regime` propaga o regime a todos do grupo.

---

## 3. Campos `computed` (derivados em runtime — NÃO persistir) e lógica de negócio

| Onde | Campo/Constante | Lógica |
|---|---|---|
| global | `VALOR_HORA = 80` | R$/hora para o comparativo |
| motor | `honorarioComercial()` / `calcularHonorarioPlanilha()` | Replica a planilha: `TABELA_FUNCIONARIOS`, `TABELA_FATURAMENTO`, `multiplicadorRegime` (Real 1 / Presumido 0,8 / Simples 0,5), `valorUnitFilial` (base R$1621), piso R$500 |
| comercial | numeroProposta (display), honorarioCalculado, horasComparativo, tempoConversao | |
| clientes | origemProspeccao | busca o `canal` no Comercial (inclui herança da matriz do grupo) |
| rentabilidade | faturamentoContratado, desvioFaturamento, desvio (horas), grupoCliente | |
| tabelas | cidadeUf | `cidade/estado` |

Tudo isso **permanece calculado no app** a partir dos dados vindos do banco. O único "número" persistido do lado de proposta é `_numeroProposta` (a sequência).

---

## 4. Dados apenas de interface (NÃO vão para o banco)

`chipMap`, `label`, `shortLabel`, `icon`, `title`, `subtitle`, `columns`, `sortField`, `sortDir`, `isMaster`. As listas de `options` dos `select` **viram `CHECK constraints`** (ver §7). `DATE_FIELD_MAP`, `HIST_TIPOS`, `HIST_CHIP` são configuração de UI.

---

## 5. Dependências externas e modelos `.docx`

- **CDN (runtime):** SheetJS/XLSX `0.18.5`, jsPDF `2.5.1`, JSZip `3.10.1` (todos cdnjs). Continuam necessários (importação Excel, PDF, montar `.docx`).
- **APIs externas:** `brasilapi.com.br/api/cnpj/v1/<cnpj>` (autofill por CNPJ) e webhook opcional do Teams (`assescont_teams_webhook`, hoje em `localStorage`).
- **`DOCX_TEMPLATES_B64`** — 3 modelos `.docx` embutidos em base64: chaves `simples`, `semFolha`, `comFolha` (escolhidos por regime/serviço). São **assets estáticos do app**, não dados de cliente.
  - **Recomendação:** tirá-los do bundle (são o que infla o HTML para 2,6 MB). Duas opções: (a) subir para um bucket **privado** no Storage (`modelos-proposta/`) e baixar sob demanda; ou (b) mantê-los como arquivos estáticos versionados no repositório (`/public/modelos/*.docx`), carregados via `fetch`. Recomendo **(b)** — são estáticos, versionáveis, não são dados sensíveis por cliente e evitam custo/latência de Storage. O Storage fica reservado para os arquivos gerados por cliente (PDF/DOCX/anexos).

---

## 6. Autenticação atual e por que é insegura

`tryLogin()` compara o campo digitado com a constante **`ACCESS_CODE = "assescont2026"`**, em texto puro no JS do cliente; o "usuário" é só um nome guardado em `sessionStorage`. Problemas:
- A senha está **visível para qualquer um** que abra o arquivo/DevTools — não há segredo real.
- Não há identidade por usuário, sessão de servidor, expiração, nem controle de acesso ao dado.
- Com um backend real (Supabase), o dado passaria a ser acessível pela API — um gate client-side não protege nada.

**Substituir por Supabase Auth (e-mail/senha)**, com o acesso ao dado dependendo de sessão autenticada + **RLS**.

---

## 7. Schema relacional proposto (PostgreSQL / Supabase) — para aprovação

### Convenções e decisões
- **`snake_case`** no banco; mapa camelCase↔snake_case mantido na camada de dados (§8).
- `id uuid primary key default gen_random_uuid()`; **preservar os `id` legados** na migração (o app usa `id` no formato `'r'+timestamp+rand`; então **`id` será `text`, não `uuid`**, para preservar os valores existentes sem reescrever referências — ver nota abaixo).
- `created_at timestamptz default now()`, `updated_at timestamptz` + trigger `set_updated_at`.
- `select` → `text` + **`CHECK`** com as opções válidas. **Decisão: CHECK em vez de tabela de domínio** — as listas são curtas, estáveis e específicas da UI; tabelas de domínio adicionariam joins e manutenção sem ganho real. (Se você preferir domínio, dá para trocar depois.)
- `currency` → `numeric(14,2)`; `date` → `date`; `number` → `integer` (contagens) ou `numeric` (horas/índices).
- `file` → coluna `*_path text` guardando o caminho no Storage.
- `filiaisDetalhado`/arrays → `jsonb`.
- **RLS habilitado em todas as tabelas**, sem tabela pública sem política.

> **Nota sobre `id text` vs `uuid`:** o prompt pede `uuid default gen_random_uuid()` **e** preservar os `id` existentes. Os `id` legados (`'r1720...'`) **não são UUIDs válidos**, então não cabem numa coluna `uuid`. Duas saídas: **(A)** usar `id text primary key default (gen_random_uuid())::text` — preserva os legados como estão, novos são uuid textual; **(B)** `id uuid` e **remapear** todos os `id` legados para novos uuids durante a migração (com um dicionário de/para para reescrever os `cliente_id`). Recomendo **(A)** — migração idempotente trivial e zero risco de quebrar referências. O DDL abaixo usa (A). Me diga se prefere (B).

### DDL proposto (resumo — versão completa vira `supabase/migrations/0001_init.sql`)

```sql
-- Extensão para gen_random_uuid()
create extension if not exists pgcrypto;

-- Trigger util de updated_at
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ MESTRE ============
create table clientes (
  id text primary key default (gen_random_uuid())::text,
  cnpj text not null,
  razao_social text not null,
  grupo text,
  regime text check (regime in ('Simples Nacional','Lucro Presumido','Lucro Real','MEI')),
  funcionarios integer,
  logradouro text, numero_endereco text, complemento text,
  cidade text, estado text, cnae_principal text,
  responsavel_legal text, telefone_contato text, email_contato text,
  competencia_entrada text,
  data_assinatura_contrato date,
  numero_proposta text, numero_contrato text,
  status_cliente text check (status_cliente in ('Ativo','Cancelado')),
  competencia_saida text,
  motivo_cancelamento text check (motivo_cancelamento in ('Insatisfação','Financeiro')),
  honorario numeric(14,2), faturamento numeric(14,2),
  sistema_financeiro text,
  data_aniversario date, proxima_renovacao date,
  base_conhecimento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on clientes (cnpj);
create index on clientes (grupo);
create index on clientes (status_cliente);

-- ============ COMERCIAL ============
create table comercial (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text references clientes(id) on delete set null,   -- nulo até o aceite
  numero_proposta integer,                                       -- sequência (_numeroProposta)
  cnpj text not null, razao_social text not null,
  regime_tributario text check (regime_tributario in ('Simples Nacional','Lucro Presumido','Lucro Real')),
  servico_contratado text check (servico_contratado in ('Com folha de pagamento','Sem folha de pagamento')),
  faturamento_anual numeric(14,2),
  filiais integer, grupo text,
  cnpjs_filiais jsonb default '[]'::jsonb,
  funcionarios integer,
  documentos text check (documentos in ('Completos','Pendentes','Não iniciado')),
  sistema_financeiro text, competencia_entrada text,
  data_envio_proposta date,
  status_proposta text check (status_proposta in ('Proposta enviada','Aceita','Pendente','Recusada')),
  data_ganho date,
  motivo_recusa text,
  canal text check (canal in ('Indicação','Site','Prospecção ativa','Rede social','Constituição','Outro')),
  proposta_pdf_path text, proposta_docx_path text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on comercial (cliente_id);
create index on comercial (status_proposta);
create index on comercial (data_envio_proposta);
create index on comercial (numero_proposta);

-- ============ SATÉLITES (cascade) ============
create table onb (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  procuracoes text, documentacao text, open_bank text, certificado text,
  configuracao_nfs text, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on onb (cliente_id);

create table demandas (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  demanda text not null,
  data_recebida date, prazo date,
  setor text, status text,
  recorrente text check (recorrente in ('Não','Sim')),
  periodo_recorrencia text,
  anexo_path text,
  recorrencia_gerada boolean default false,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on demandas (cliente_id);
create index on demandas (prazo);
create index on demandas (status);

create table relacionamento (
  id text primary key default (gen_random_uuid())::text,
  chave text not null unique,
  cliente_id text references clientes(id) on delete set null,   -- chave é o identificador real
  classificacao text check (classificacao in ('A','B','C','D')),
  semaforo text check (semaforo in ('Verde','Amarelo','Vermelho')),
  qtd_indicacoes_feitas integer,
  indice_manual numeric,
  alertas text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on relacionamento (cliente_id);

create table oportunidades (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  oportunidade text not null,
  origem text, data date,
  valor_estimado text,                                          -- é texto na origem
  responsavel text,
  status text check (status in ('Identificada','Em andamento','Convertida','Perdida')),
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on oportunidades (cliente_id);
create index on oportunidades (data);

create table agenda (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  periodicidade text, data_programada date, responsavel text,
  status text check (status in ('Programada','Realizada','Remarcada','Cancelada')),
  observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on agenda (cliente_id);
create index on agenda (data_programada);

create table certificados (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  bancos text, certificados text, vencimento_certificado date,
  nf_saida text check (nf_saida in ('Configurada','Pendente','Não se aplica')),
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on certificados (cliente_id);
create index on certificados (vencimento_certificado);

create table rentabilidade (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  competencia text not null,
  faturamento_atual numeric(14,2),
  horas_orcadas numeric, horas_gastas numeric,
  observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on rentabilidade (cliente_id);

create table rnc (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  setor text, data date,
  classificacao_erro text check (classificacao_erro in ('Leve','Moderado','Grave')),
  multa text check (multa in ('Não','Sim - paga pela Assescont','Sim - paga pelo cliente')),
  valor_multa numeric(14,2),
  medida_corretiva text,
  cliente_notificou text check (cliente_notificou in ('Sim','Não')),
  medida_preventiva text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on rnc (cliente_id);
create index on rnc (data);

create table parceiros (
  id text primary key default (gen_random_uuid())::text,
  parceiro text not null,
  area_atuacao text,
  cliente_comum_id text references clientes(id) on delete set null,
  qtd_indicacoes integer,
  acordos text,
  created_at timestamptz not null default now(), updated_at timestamptz
);

-- ============ LOGS INTERNOS ============
create table historico (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  tipo text check (tipo in ('Reunião','Ligação','WhatsApp','E-mail','Visita','Elogio','Reclamação','Solicitação')),
  data date, assunto text, observacoes text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on historico (cliente_id);
create index on historico (data);

create table reajustes (
  id text primary key default (gen_random_uuid())::text,
  cliente_id text not null references clientes(id) on delete cascade,
  data date,
  honorario_anterior numeric(14,2), honorario_novo numeric(14,2),
  margem_lucro_percentual numeric,
  bases_utilizadas text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create index on reajustes (cliente_id);

-- trigger updated_at em todas
-- (gerado para cada tabela na migração)
```

### Justificativa dos `ON DELETE` por tabela
| Tabela | Regra | Porquê |
|---|---|---|
| onb, demandas, oportunidades, agenda, certificados, rentabilidade, rnc, historico, reajustes | **CASCADE** | Registros satélites/logs não fazem sentido sem o cliente; ao excluir o cliente, some tudo dele. |
| comercial | **SET NULL** | A proposta é um registro comercial com valor histórico próprio (nº, data, motivo). Deve sobreviver à exclusão do cliente e voltar ao estado "aguardando aceite" (mantém cnpj/razão social). |
| relacionamento | **SET NULL** | Identidade real é `chave` (nível grupo). Excluir um cliente do grupo não deve apagar o health score do grupo. |
| parceiros.cliente_comum_id | **SET NULL** | Referência secundária opcional; a parceria existe independentemente do cliente. |

### Política RLS proposta (para discussão)
Modelo mais simples que atende o cenário (equipe interna, todos autenticados enxergam tudo):
```sql
alter table clientes enable row level security;
create policy "authenticated_all" on clientes
  for all to authenticated using (true) with check (true);
```
…replicado em todas as tabelas. **Premissa explícita:** todo usuário autenticado (funcionário da Assescont) tem acesso total de leitura/escrita a todos os registros. Não há multi-tenant nem papéis distintos hoje. Se você quiser papéis (ex.: só admin exclui, ou segmentar por setor), me diga que eu ajusto as políticas.

### Storage (buckets)
- `anexos-crm` (privado) — anexos de demandas e PDFs/DOCX gerados por cliente. Caminho: `<entidade>/<id>/<arquivo>`.
- Acesso apenas a usuários autenticados (policy no bucket).
- Modelos `.docx` estáticos: recomendo **repositório** (`/public/modelos/`), não Storage (ver §5).

---

## 8. Mapa camelCase ↔ snake_case (amostra)
`razaoSocial↔razao_social`, `clienteId↔cliente_id`, `dataEnvioProposta↔data_envio_proposta`, `statusProposta↔status_proposta`, `faturamentoAnual↔faturamento_anual`, `cnpjsFiliais↔cnpjs_filiais`, `propostaPdf↔proposta_pdf_path`, `propostaDocx↔proposta_docx_path`, `_numeroProposta↔numero_proposta`, `_recorrenciaGerada↔recorrencia_gerada`, `openBank↔open_bank`, `configuracaoNFs↔configuracao_nfs`, `qtdIndicacoesFeitas↔qtd_indicacoes_feitas`, `indiceManual↔indice_manual`, `clienteComum↔cliente_comum_id`, `honorarioAnterior↔honorario_anterior`, etc. O mapa completo fica na camada `repository.js`.

---

## 9. Como proceder (dado o §0)

Preciso da sua decisão antes de avançar. Opções:

- **A. Eu preparo tudo como código; você executa o CLI.** Entrego migrações versionadas, front-end refatorado, README e `vercel.json`. Você roda `supabase link` + `supabase db push` e `vercel` autenticado. (Recomendado — respeita 100% o isolamento, você controla as credenciais.)
- **B. Você conecta os MCPs de Supabase/Vercel** (numa sessão interativa do Claude Code, via `claude mcp` / `/mcp`) e reiniciamos — aí eu opero via conector, ainda com sua confirmação a cada ação irreversível.
- **C. Só o schema + migrações agora**, e decidimos o resto depois.

**Nada será executado até você aprovar (i) o schema desta etapa e (ii) o caminho A/B/C.**
