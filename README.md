# CRM Relacionamento — Assescont (back-end + login)

O CRM continua sendo o mesmo app de antes, mas agora:
- **guarda os dados num banco (Supabase)** — não ficam mais presos num só navegador;
- **tem login por e-mail/senha** conferido numa tabela `user` própria (senhas em
  hash bcrypt).

> **O front quase não mudou.** A única alteração de interface é a **tela de login**
> (agora e-mail/senha). Todas as telas, cálculos e o resto do app continuam iguais.

---

## Como funciona

- Ao abrir, o app pede **login (e-mail/senha)**, conferido na tabela `user` do
  Supabase (senhas em hash bcrypt, verificadas por uma função no servidor).
- Depois de entrar, o app **baixa o estado do banco** e mostra no app.
- A cada alteração, salva o estado no banco. Se o banco estiver vazio, sobe o que
  houver no navegador na primeira gravação (migração automática).

Os dados ficam numa tabela `crm_state` (um documento JSON compartilhado pela equipe).

---

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O app. Igual ao original, exceto a tela de login + 2 linhas que carregam o back-end. |
| `backend-sync.js` | Back-end: login (Supabase Auth) + leitura/gravação no banco. **Credenciais aqui.** |
| `RELACIONAMENTO_ASSESCONT_-_07_2026_2.html` | Original intocado (backup). |
| `supabase/migrations/0001_init.sql` | Cria a tabela `crm_state`. |
| `supabase/migrations/0002_auth_only.sql` | (Obsoleto) travava por Supabase Auth — substituído pelo login por tabela. |
| `supabase/migrations/0003_user_login.sql` | Cria a tabela `user` + função de login (bcrypt). **Modelo de login atual.** |
| `vercel.json` | Config do deploy estático. |

---

## Passo a passo (você executa, nas SUAS contas)

### 1. Banco (já feito)
A tabela `crm_state` já foi criada (você rodou o `0001_init.sql`). ✅

### 2. Criar a tabela de login e a função (rodar a migração)
No **SQL Editor**, cole e rode o conteúdo de `supabase/migrations/0003_user_login.sql`.
Isso cria a tabela `user` (senhas em bcrypt) e a função `verify_login`.
> Pode pular o `0002_auth_only.sql` — ele era do modelo com Supabase Auth, que foi
> substituído por este login por tabela.

### 3. Criar o(s) usuário(s) de login
Ainda no **SQL Editor**, rode (troque e-mail/senha/nome; repita para cada pessoa):
```sql
select public.set_user('automacao@assescont.com.br', 'TROQUE_ESTA_SENHA', 'Admin');
```
Para desativar um acesso: `update public."user" set ativo = false where email = '...';`

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
- [ ] `0003_user_login.sql` aplicado (tabela `user` + função de login).
- [ ] Pelo menos um usuário criado com `set_user(...)`.
- [ ] Teste: login funciona; dados persistem após recarregar.
- [ ] Deploy na Vercel (projeto novo) e URL de produção acessível.

---

## Segurança
- **Login por tabela `user`:** e-mail/senha conferidos por uma função no servidor
  (`verify_login`). As senhas ficam em **hash bcrypt** e não são expostas — a tabela
  `user` não é lida diretamente pelo front.
- A chave **publishable** no `backend-sync.js` é pública por design.
- A `service_role` key **nunca** aparece no código.

> **Limitação importante (leia):** como este login NÃO usa o Supabase Auth, não há
> uma sessão que o banco reconheça. Por isso o acesso à tabela de dados (`crm_state`)
> é liberado pela chave pública — o login protege a **tela**, mas quem tiver a URL do
> site e a chave consegue ler/escrever os dados direto. Para proteção real do banco,
> seria necessário voltar ao Supabase Auth (ou um servidor intermediário). É só avisar.

### Observações
- **Dados compartilhados:** toda a equipe usa o mesmo estado (`id = 'default'`).
  Em edições simultâneas, vale a última gravação.
- **Gerenciar usuários:** criar/atualizar acessos com `select public.set_user(email,
  senha, nome);` no SQL Editor; desativar com `update public."user" set ativo=false`.
