# CRM Relacionamento — Assescont (back-end)

O CRM continua sendo **exatamente o mesmo app** de antes. A única diferença é que
agora, além de salvar no navegador, ele **guarda tudo num banco de dados (Supabase)**
— assim os dados não ficam presos num único computador.

> **O front não foi alterado.** O `index.html` é idêntico ao original, exceto por
> **uma linha** que carrega o adaptador de back-end (`backend-sync.js`). Nenhuma
> tela, cálculo, login ou comportamento mudou.

---

## Como funciona

- O app grava tudo (todos os inputs do front) num único objeto, como sempre fez.
- O `backend-sync.js` intercepta essa gravação e **envia uma cópia ao banco**.
- Ao abrir a página, ele **busca os dados no banco** e entrega ao app. Se o banco
  estiver vazio, usa o que houver no navegador e o **sobe** na primeira gravação
  (migração automática dos dados antigos).

Os dados ficam numa tabela `crm_state` (um documento JSON compartilhado pela equipe).

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O app (original + 1 linha que carrega o `backend-sync.js`). |
| `backend-sync.js` | O adaptador de back-end (fala com o Supabase). **Aqui vão as credenciais.** |
| `RELACIONAMENTO_ASSESCONT_-_07_2026_2.html` | Original intocado (backup). |
| `supabase/migrations/0001_init.sql` | Cria a tabela `crm_state`. |
| `vercel.json` | Config do deploy estático. |

---

## Passo a passo (você executa, nas SUAS contas)

> Crie recursos **novos e dedicados**. Não reaproveite projetos existentes.

### 1. Criar o projeto no Supabase
Em https://supabase.com, crie um **projeto novo** (ex.: `crm-relacionamento-assescont`).

### 2. Criar a tabela
No projeto, abra **SQL Editor**, cole o conteúdo de
`supabase/migrations/0001_init.sql` e clique em **Run**.
(Ou via CLI: `supabase link --project-ref <REF>` e `supabase db push`.)

### 3. Preencher as credenciais
No painel: **Project Settings > API**. Copie a **Project URL** e a **anon public** key.
Abra `backend-sync.js` e preencha no topo:
```js
var SUPABASE_URL      = "https://SEU-PROJETO.supabase.co";
var SUPABASE_ANON_KEY = "eyJ...sua-anon-key...";
```
> Nunca use a `service_role` key aqui.

### 4. Testar
Abra `index.html` no navegador. Entre no app (mesma tela de sempre). Crie/edite um
registro; recarregue a página — os dados devem continuar lá (agora vêm do banco).
Para conferir: no painel do Supabase, **Table Editor > crm_state** deve ter 1 linha.

### 5. Publicar na Vercel
- **CLI:** `vercel` (crie um projeto **novo**) e depois `vercel --prod`.
- **Painel:** vercel.com > Add New > Project > importe esta pasta. Framework: **Other**
  (site estático, sem build). Deploy.

Entregue a URL de produção ao final.

---

## Checklist
- [ ] Projeto Supabase novo criado.
- [ ] Tabela `crm_state` criada (rodou o `0001_init.sql`).
- [ ] `SUPABASE_URL` e `SUPABASE_ANON_KEY` preenchidos em `backend-sync.js`.
- [ ] Teste local: dados persistem após recarregar; `crm_state` tem 1 linha.
- [ ] Projeto Vercel novo criado e deploy de produção feito.

---

## ⚠️ Sobre segurança de acesso (leia)

Como **o front não foi alterado**, o app mantém a tela de login **original**, que é
apenas visual (roda no navegador e não protege o banco). O acesso ao banco é feito
com a **chave anônima**, que fica no `backend-sync.js` (servido publicamente).

**Na prática:** quem tiver a URL do site e olhar o código consegue ler/escrever os
dados. Isso é uma consequência direta de "não mexer no front".

Se você quiser **segurança real** (login por usuário que de fato protege os dados),
isso exige alterar a tela de login para autenticar no Supabase — me avise que eu
faço a versão mínima disso. Enquanto isso, dá para reduzir a exposição mantendo a
URL do site restrita ao seu time.
