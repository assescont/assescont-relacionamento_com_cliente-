# Mapa do Sistema — CRM Relacionamento Assescont

> Mapeamento de todas as abas e funcionalidades, extraído da versão atual do app
> (`index.html`). Serve de referência para manutenção e para checar coerência de
> mudanças futuras.

## Visão geral
- App de página única (`index.html`): navegação por **abas** na lateral + **Dashboard**.
- `clientes` é a **base mestre**; as demais abas referenciam o cliente por `clienteId`.
- Dados no schema **`crm`** (Supabase), acessados via **gateway** (login por token; ver
  `docs/PROMPT-AGENTE-CRM.md`). Campos **calculados** (marcados abaixo) não são gravados —
  são derivados em runtime.

---

## 1. Dashboard (tela inicial)
Painel de indicadores e navegação rápida. Componentes:
- **Cards do topo:** Clientes ativos/novos, Reuniões (com tendência ▲/▼ vs. mês anterior),
  RNC, multas pagas pela Assescont, previsão em propostas (pipeline).
- **Quadro "Resultado do setor":** 6 indicadores (retenção, índice médio da carteira, conversão
  comercial, cross-sell convertido R$, ganho com reajustes R$, RNC por cliente ativo) — clicáveis.
- **Quadros analíticos:** clientes por cidade, honorário por estado, **mapa do Brasil** colorido,
  direcionamento comercial por segmento/divisão, clientes mais antigos, capacidade operacional.
- **Drill-down:** clicar em segmento/estado/cidade filtra a aba Clientes.
- **Filtro de período** global; **lembrete de backup** (banner após 7+ dias); botão
  **Relatório executivo (PDF)**.

## 2. Abas (formulários)

### 💰 Comercial (`comercial`)
Propostas; primeiro cadastro pelo CNPJ. **Honorário calculado pela planilha** (faturamento +
funcionários + regime + filiais); comparativo em horas (R$ 180/h). Ao **aceitar**, cria o
Cliente + ONB e pode gerar **proposta em PDF e Word**.
- Campos: cnpj*, razaoSocial*, regimeTributario, servicoContratado, faturamentoAnual, filiais,
  grupo, cnpjsFiliais, funcionarios, `honorarioCalculado`(calc), honorarioEnviado,
  `horasComparativo`(calc), documentos, sistemaFinanceiro, competenciaEntrada, diaVencimento,
  socioContratante, cpfSocioContratante, emailSocioContratante, dataEnvioProposta, prazoRetorno
  (gera lembrete em Demandas), statusProposta, dataGanho, `tempoConversao`(calc), motivoRecusa,
  canal, propostaPdf, propostaDocx. `numeroProposta`(calc, sequência).

### 🏢 Clientes (`clientes`) — base mestre
Cadastro único. **Autofill por CNPJ** (endereço/CNAE via BrasilAPI). **Divisão econômica**
(automática pelo CNAE, com override manual). **Resumo 360°** (👁️) com exportação em PDF.
Históricos de **honorário** (💰) e de **status/nível** (📋). Edição em massa e detecção de grupo.
- Campos: cnpj*, razaoSocial*, grupo, regime, funcionarios, endereço (logradouro, numeroEndereco,
  complemento, bairro, cep, cidade, estado), cnaePrincipal, idExterno, divisaoManual,
  responsavelLegal, cpfResponsavelLegal, emailResponsavelLegal, telefoneContato, emailContato,
  competenciaEntrada, dataAssinaturaContrato, numeroProposta, numeroContrato,
  `origemProspeccao`(calc), statusCliente, competenciaSaida, motivoCancelamento, honorario,
  faturamento, sistemaFinanceiro, dataAniversario, proximaRenovacao, baseConhecimento.

### 🚀 ONB (`onb`) — onboarding
Checklist de entrada do cliente. Campos: clienteId*, procuracoes, documentacao, openBank,
certificado, configuracaoNFs, observacoes (todos Concluído/Pendente/Não iniciado).

### 📋 Demandas (`demandas`)
Tudo que chega ao setor, com **recorrência**, lembrete de prazo e anexo. Integração opcional
com **Teams** (aviso de nova demanda). Campos: clienteId*, demanda*, dataRecebida, prazo, setor
(Fiscal/Contábil/Pessoal/Legalização/Comercial/T.I/Diretoria/Marketing/Advisa), status,
recorrente, periodoRecorrencia, conclusaoAndamento, anexo.

### 🩺 Relacionamento (`relacionamento`) — Health Score
Saúde por cliente/grupo. **Índice automático** (RNC, reuniões, visitas, indicações) + índice
manual, **semáforo** e **classificação A/B/C/D**. Histórico de **interações** (Reunião, Ligação,
WhatsApp, E-mail, Visita, Elogio, Reclamação, Solicitação). Campos: classificacao, semaforo,
qtdIndicacoesFeitas, indiceManual, alertas (chaveado por grupo/cliente).

### 🎯 Oportunidades (`oportunidades`) — cross-selling
Campos: clienteId*, oportunidade*, origem (inclui "Renegociação de honorário"), data,
valorEstimado, responsavel, status (Identificada/Pendente/Em andamento/Convertida/Perdida).

### 📅 Agenda (`agenda`)
Reuniões + **alertas** de clientes sem contato, aniversários e renovações. Campos: clienteId*,
periodicidade, dataProgramada, responsavel, status, observacoes.

### 📁 Projetos (`certificados`)
Um projeto por cliente: **Certificado Digital / Open Finance / NF de Saída**, com status e prazo.
Campos: clienteId*, tipoProjeto*, status, prazo, observacoes.

### 📈 Rentabilidade (`rentabilidade`)
Parâmetros contratados x atuais (import. Domínio), por CNPJ, com visão por grupo. Vários
indicadores **calculados**: faturamentoContratado, funcionariosContratado, valorHoraCobrado,
custoEstimadoHoras (horas × R$ 180), desvioReais, **ajusteSugeridoHonorario** e
**honorarioSugerido** → botão para **negociar** (cria Oportunidade). Campos gravados: clienteId*,
competencia*, faturamentoAtual, funcionariosAtual, horasOrcadas, horasGastas, observacoes.
Suporta **importação em massa** e histórico por competência.

### ⚠️ RNC (`rnc`) — não conformidades
Campos: clienteId*, setor, competencia (do erro), descricaoErro*, data (lançamento),
classificacaoErro (Leve/Moderado/Grave), multa, valorMulta, medidaCorretiva, clienteNotificou,
medidaPreventiva. Suporta **lançamento em massa**.

### 🤝 Parcerias (`parceiros`)
Rede de parceiros e ranking de indicações. Campos: parceiro*, areaAtuacao, clienteComum,
qtdIndicacoes, acordos.

### 🔐 Controle Pessoal (`acessos`)
Cofre pessoal por usuário: sistema*, categoria, link, usuario, senha, observacoes.
**usuario/senha cifrados** (AES no navegador; chave derivada da senha de login); dados **por dono**.

### Logs internos (sem aba própria)
- `historico` (interações do relacionamento), `reajustes` (histórico de honorário — modal),
  `historicoHonorario` (toda mudança de honorário: manual/importação/massa),
  `historicoStatus` (mudança de status do cliente e de nível A/B/C/D).

---

## 3. Funcionalidades transversais
- **Importação Excel/CSV** (SheetJS): casa por ID externo → CNPJ → nome normalizado (não
  duplica); detecção de grupo por raiz de CNPJ; **buscar CNAE/dados faltantes** em massa;
  limpeza de dados (datas, regime inválido, "Geral").
- **Exportação** por aba em **Excel** e **PDF** (jsPDF + autotable) com identidade visual;
  **Relatório executivo** (PDF consolidado) e **Resumo 360° do cliente** (PDF).
- **Geração de proposta** em **PDF** e **Word/.docx** (modelos por regime/serviço; JSZip).
- **Edição em massa** (seleção múltipla) e **ordenação por coluna** nas tabelas.
- **Filtros rápidos** (mini-cards clicáveis) por aba + **filtro de período** global.
- **Referência rápida** (🔍): consulta por estado/regime/divisão/segmento para prospecção.
- **Backup**: exportar/importar JSON completo + lembrete de backup.
- **Integração Teams** (webhook opcional) para pendências/novas demandas.
- **Alertas/lembretes**: clientes sem contato, aniversários, renovações, certificados/projetos
  vencendo, demandas atrasadas.
- **Limpeza de órfãos** (registros apontando para clientes excluídos).

## 4. Motores e regras de negócio
- **Honorário (planilha):** tabela por faturamento + por funcionários × multiplicador de regime
  (Real 1 / Presumido 0,8 / Simples 0,5) + valor por filial; piso R$ 500. Hora de referência: **R$ 180**.
- **Rentabilidade:** compara contratado x atual; sugere ajuste de honorário pelas horas excedentes.
- **Health Score:** índice automático por interações/RNC/indicações + manual + semáforo + A/B/C/D.
- **Aceite comercial:** ao aceitar proposta → cria/vincula Cliente + cria ONB + copia dados.
- **Espelhamento:** ao cadastrar um novo Cliente → cria proposta em Comercial + ONB (camada de back-end).

## 5. Back-end / infraestrutura (resumo)
- Dados no schema **`crm`**; acesso só via **gateway** (`crm.login`/`crm_fetch`/`crm_save` com token).
- **Login** por `crm.user` (bcrypt); **Controle Pessoal** cifrado por usuário.
- **RLS** fecha o acesso direto pela chave pública. Deploy estático (Vercel) a partir do GitHub.
- Detalhes de manutenção e regras em `docs/PROMPT-AGENTE-CRM.md`.
