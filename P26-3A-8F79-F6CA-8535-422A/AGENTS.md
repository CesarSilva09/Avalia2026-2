# Engenharia de Agentes e Harness (P26-3A-8F79-F6CA-8535-422A)

Projeto #15 — Lista de Tarefas Colaborativa (Shared To-Do). Este documento descreve os **3 agentes** usados no
desenvolvimento (um deles dedicado a **teste e validação**), o **harness** em que operaram e as **skills** que seguiram.

## 1. Harness Utilizado

- **Harness:** [Claude Code](https://claude.com/claude-code), aba *Code* do aplicativo Claude para desktop (Windows), trabalhando direto no clone do fork.
- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) no agente orquestrador e nos três subagentes.
- **Como os agentes foram definidos:** cada agente é um arquivo Markdown com cabeçalho (`name`, `description`, `tools`, `model`) no formato de *subagents* do Claude Code. As definições usadas estão em [`agents/`](./agents/) (cópia fiel do `.claude/agents/` da raiz do clone, que fica fora do Pull Request).
- **Como foram executados:** o orquestrador (sessão principal do Claude Code) disparou cada agente como subagente com a sua definição carregada como instrução. Como o Claude Code só registra agentes novos ao abrir a sessão, nesta execução cada subagente foi iniciado com o tipo genérico do harness e recebeu como primeira instrução ler e seguir o arquivo `agents/<nome>.md`, inclusive a lista de ferramentas permitidas.
- **Coordenação:** antes de qualquer código, o orquestrador escreveu o contrato [`docs/API.md`](./docs/API.md) (esquema D1, formato da sessão, objetos JSON e rotas). Com o contrato fixo, os agentes de backend e frontend trabalharam **em paralelo**, cada um restrito à sua pasta; depois o agente de teste validou os dois juntos.
- **Skill de estilo comum:** [Ponytail](./skills/ponytail/SKILL.md) (DietrichGebert/ponytail, licença MIT), apresentado em aula: a menor mudança completa, sem dependências desnecessárias e **sem cortar validação, segurança nem acessibilidade**.

```
            Orquestrador (Claude Code)  ──►  docs/API.md (contrato)
                 │                 │
       ┌─────────┘                 └─────────┐
       ▼                                     ▼
 Agente 1: backend-serverless      Agente 2: frontend-vanilla     (em paralelo)
 functions/ + migrations/          public/
       └──────────────┬──────────────────────┘
                      ▼
        Agente 3: teste-validacao  ──►  tests/ + relatório  ──►  orquestrador corrige/integra
```

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: `backend-serverless` — Cloudflare Pages Functions, D1 e Discord OAuth2
- **Definição:** [`agents/backend-serverless.md`](./agents/backend-serverless.md) — ferramentas: Read, Write, Edit, Grep, Glob, Bash.
- **Skills utilizadas:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md) e [`skills/ponytail/SKILL.md`](./skills/ponytail/SKILL.md).
- **Entregas:**
  - `migrations/0001_init.sql`: tabelas `users`, `lists`, `list_members`, `tasks` com chaves estrangeiras, `ON DELETE CASCADE`, `CHECK` e índices.
  - Login Discord (`/api/auth/discord` e `/callback`) com `state` anti-CSRF, upsert do usuário (`user_id`, nome, avatar) e cookie de sessão assinado com HMAC-SHA256 (`crypto.subtle`).
  - API REST: `me`, `logout`, `lists`, `lists/join`, `lists/[id]`, `lists/[id]/tasks`, `tasks/[id]`, com a lógica comum em `functions/_lib.js`, middleware que padroniza erros (sem stack/SQL) e 404/405 em JSON.
  - Regras no servidor: só membros acessam (não-membro recebe 404 para não revelar a lista), responsável precisa ser membro, subtarefa só sob tarefa principal da mesma lista, limites de texto, código de acesso aleatório e único.
- **Verificação própria:** `node --check` em todos os arquivos, migração aplicada no D1 local e 37 chamadas HTTP no `wrangler pages dev`.
- **Decisão registrada:** nas Pages Functions um método sem handler cai no `index.html` com 200; o agente acrescentou `onRequest` com 405 em JSON em cada rota.

### Agente 2: `frontend-vanilla` — Interface em HTML5, CSS3 e JavaScript puro
- **Definição:** [`agents/frontend-vanilla.md`](./agents/frontend-vanilla.md) — ferramentas: Read, Write, Edit, Grep, Glob (sem terminal).
- **Skills utilizadas:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md) e [`skills/ponytail/SKILL.md`](./skills/ponytail/SKILL.md).
- **Entregas:**
  - `public/index.html`, `public/styles.css`, `public/app.js` sem nenhum framework ou CDN.
  - Tela de login, painel de listas (criar, entrar com código, progresso), lista aberta com membros e avatares, tarefas e subtarefas, troca de responsável com avatar do Discord, conclusão e exclusão.
  - Sincronização: cada ação chama a API e redesenha a partir da resposta; recarga a cada 5 s com a aba visível, preservando foco e texto digitado e descartando respostas atrasadas.
  - Segurança e acessibilidade: dados do usuário só via `textContent`, `<label>` em todos os controles, região `aria-live` para erros, foco visível, layout responsivo e modo escuro.
  - Chave `P26-3A-8F79-F6CA-8535-422A` no `<footer>` estático.

### Agente 3: `teste-validacao` — Agente de Teste e Validação (obrigatório)
- **Definição:** [`agents/teste-validacao.md`](./agents/teste-validacao.md) — ferramentas: Read, Grep, Glob, Bash, Write; **proibido alterar o código da aplicação**, só pode escrever em `tests/` e relatar.
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md).
- **Entregas:**
  - Suíte [`tests/api.test.mjs`](./tests/api.test.mjs) (`node:test`, sem dependências), [`tests/seed.sql`](./tests/seed.sql) e [`tests/README.md`](./tests/README.md).
  - **42 testes, 42 aprovados**, executados duas vezes contra o `wrangler pages dev` com D1 local, sem nenhuma resposta 5xx:
    - sessão ausente, adulterada, expirada, com segredo errado ou malformada → 401;
    - isolamento entre listas (leitura, criação, edição e exclusão por não-membro → 404, dado intacto);
    - entrada por código inválido (404), repetido e concorrente (sem duplicar membro);
    - responsável não membro, subtarefa de outra lista, sub-subtarefa, títulos vazios/longos, `done` não booleano → 400;
    - fluxo feliz com dois usuários vendo o mesmo estado; DELETE em cascata; 13 métodos não suportados → 405;
    - injeção SQL/HTML gravada como texto literal; início do OAuth com `state`.
  - Revisão de integração frontend × backend rota por rota: **nenhuma divergência**.
  - Verificação estática do frontend (sem frameworks/CDN, sem `innerHTML`, labels, rodapé) e `node validar-local.mjs`.
- **Achados que geraram ajuste:** o contrato não dizia sobre qual texto a assinatura HMAC é calculada; o orquestrador acrescentou isso ao `docs/API.md`.
- **Limites declarados pelo próprio agente:** não testou o login com o Discord real (exige credenciais), o ambiente remoto nem a interface no navegador.

---

## 3. Skills (`skills/`)

| Skill | Usada por | Origem |
| --- | --- | --- |
| [`serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) | backend-serverless | Gerada pelo `iniciar.mjs` e ampliada com as regras do projeto #15 |
| [`vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) | frontend-vanilla | Gerada pelo `iniciar.mjs` e ampliada com as regras do projeto #15 |
| [`teste-validacao`](./skills/teste-validacao/SKILL.md) | teste-validacao | Gerada pelo `iniciar.mjs` e ampliada com os casos obrigatórios do projeto #15 |
| [`ponytail`](./skills/ponytail/SKILL.md) | backend-serverless, frontend-vanilla | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), copiada sem alterações (MIT) |
