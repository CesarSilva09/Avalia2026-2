# Projeto #15: Lista de Tarefas Colaborativa (Shared To-Do)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Cesar Augusto Silva
- **Turma:** 3A
- **Chave Única:** `P26-3A-8F79-F6CA-8535-422A`
- **URL_CLOUDFLARE:** `https://p26-3a-8f79-f6ca-8535-422a.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Construa um gerenciador de tarefas voltado para pequenas equipes de trabalho acadêmico. Após o login via Discord, o usuário pode criar listas de tarefas e compartilhar o código de acesso da lista com colegas de turma, permitindo que múltiplos usuários autenticados visualizem e interajam com os mesmos itens.

No Cloudflare D1, o esquema relacional deve contemplar tabelas para usuários, listas, membros da lista e tarefas. Através de JavaScript vanilla, os integrantes podem criar subtarefas, atribuir um responsável (exibindo o avatar do Discord do colega no item) e alterar o status de conclusão, sincronizando o estado com o servidor a cada interação.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-3A-8F79-F6CA-8535-422A`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-3A-8F79-F6CA-8535-422A
   npx.cmd wrangler d1 create db-p26-3a-8f79-f6ca-8535-422a
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-3a-8f79-f6ca-8535-422a`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-3a-8f79-f6ca-8535-422a.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-3A-8F79-F6CA-8535-422A` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
