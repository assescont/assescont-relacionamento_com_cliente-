# CRM Relacionamento — Assescont (back-end + login)

O CRM continua sendo o mesmo app de antes, mas agora:
- **guarda os dados num banco (Supabase)** — não ficam mais presos num só navegador;
- **tem login real (e-mail/senha via Supabase Auth)** — o acesso aos dados exige
  usuário autenticado.

> **O front quase não mudou.** A única alteração de interface é a **tela de login**
> (agora e-mail/senha). Todas as telas, cálculos e o resto do app continuam iguais.

---

## Como funciona

- Ao abrir, o app pede **login (e-mail/senha)**. Sem login, não há acesso aos dados.
- Depois de autenticar, ele **baixa o estado do banco** e mostra no app.
- A cada alteração, salva o estado no banco (autenticado). Se o banco estiver vazio,
  sobe o que houver no navegador na primeira gravação (migração automática).

Os dados ficam numa tabela `crm_state` (um documento JSON compartilhado pela equipe),
protegida por **RLS**: só usuários autenticados leem/escrevem.

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O app. Igual ao original, exceto a tela de login + 2 linhas que carregam o back-end. |
| `backend-sync.js` | Back-end: login (Supabase Auth) + leitura/gravação no banco. **Credenciais aqui.** |
| `RELACIONAMENTO_ASSESCONT_-_07_2026_2.html` | Original intocado (backup). |
| `supabase/migrations/0001_init.sql` | Cria a tabela `crm_state`. |
| `supabase/migrations/0002_auth_only.sql` | Trava o acesso: só usuários autenticados. |
| `vercel.json` | Config do deploy estático. |

---

## Passo a passo (você executa, nas SUAS contas)

### 1. Banco (já feito)
A tabela `crm_state` já foi criada (você rodou o `0001_init.sql`). ✅

### 2. Criar o(s) usuário(s) de login
No painel do Supabase: **Authentication → Users → Add user**. Informe e-mail e senha.
Usuários criados aqui já vêm **confirmados** e podem entrar direto.
(Repita para cada pessoa da equipe.)

### 3. Trancar o acesso (rodar a 2ª migração)
No **SQL Editor**, cole e rode o conteúdo de `supabase/migrations/0002_auth_only.sql`.
A partir daí, só quem tem login acessa os dados.
> Faça isto **depois** de já ter criado ao menos um usuário (passo 2).

### 4. Credenciais no app (já feito)
`SUPABASE_URL` e a chave publishable já estão no `backend-sync.js`. ✅
(A chave publishable é pública por design; quem protege os dados é o login + RLS.)

### 5. Testar
Abra o app, faça login com o usuário do passo 2. Crie/edite um registro; recarregue —
os dados devem continuar lá (vêm do banco). Confira em **Table Editor → crm_state**.

### 6. Publicar na Vercel
- **Painel:** vercel.com → Add New → Project → importe o repositório
  `assescont/assescont-relacionamento_com_cliente-`. Framework: **Other** (site
  estático, sem build). Deploy.
- **CLI:** `vercel` (projeto novo) e `vercel --prod`.

Não precisa configurar variáveis de ambiente na Vercel.

---

## Checklist
- [x] Tabela `crm_state` criada (`0001_init.sql`).
- [ ] Pelo menos um usuário criado em Authentication → Users.
- [ ] `0002_auth_only.sql` aplicado (acesso só para autenticados).
- [ ] Teste: login funciona; dados persistem após recarregar.
- [ ] Deploy na Vercel (projeto novo) e URL de produção acessível.

---

## Segurança
- **Login real:** e-mail/senha via Supabase Auth. Sem sessão válida, o app não
  carrega os dados e o banco recusa o acesso (RLS `authenticated`).
- A chave **publishable** no `backend-sync.js` é pública por design — ela sozinha
  não dá acesso aos dados; é preciso estar logado.
- A `service_role` key **nunca** aparece no código.

### Observações
- **Dados compartilhados:** toda a equipe usa o mesmo estado (`id = 'default'`).
  Em edições simultâneas, vale a última gravação.
- **Gerenciar usuários:** criar/remover acessos é feito no painel do Supabase
  (Authentication → Users).
