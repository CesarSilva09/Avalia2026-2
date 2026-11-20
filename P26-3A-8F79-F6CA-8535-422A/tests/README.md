# Testes da API — Shared To-Do (P26-3A-8F79-F6CA-8535-422A)

Sem dependências npm: `node:test`, `node:assert` e `fetch` nativos (Node 20+). Contrato em `docs/API.md`.

Na pasta do projeto (Windows/PowerShell; no Bash troque `npx.cmd` por `npx`):

```powershell
# 1. .dev.vars de teste (NÃO commitar). SESSION_SECRET aleatório; Discord com valores falsos basta.
#    DISCORD_CLIENT_ID=teste-local / DISCORD_CLIENT_SECRET=teste-local / SESSION_SECRET=<aleatório>
# 2. banco local + usuários de teste
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler d1 execute DB --local --file tests/seed.sql
# 3. servidor (outro terminal)
npx.cmd wrangler pages dev --port 8788
# 4. testes
$env:SESSION_SECRET = "<o mesmo do .dev.vars>"; node --test tests/
```

Variáveis: `BASE_URL` (padrão `http://127.0.0.1:8788`) e `SESSION_SECRET` (obrigatória; os cookies de
sessão dos usuários de teste são assinados com ela). A suíte cria listas novas a cada execução, então pode
ser repetida sem limpar o banco. Para não misturar com dados de desenvolvimento, use o mesmo
`--persist-to <pasta>` nos três comandos do wrangler.

Cobre: sessão ausente/adulterada/expirada/malformada, isolamento entre listas, entrada por código
(inválido, repetido, concorrente), responsável não membro, subtarefa de outra lista e sub-subtarefa,
limites de título/nome, `done` booleano, fluxo com dois usuários, DELETE em cascata, 405, injeção SQL/HTML
armazenada literalmente, início do OAuth (302 + `state`) e nenhuma resposta 5xx.
