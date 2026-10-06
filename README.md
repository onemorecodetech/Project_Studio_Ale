# Studio Alessandra — Site + Painel Admin

Site público em `www.studioalenails.com.br` e painel em `admin.studioalenails.com.br`, no mesmo projeto e no mesmo deploy da Vercel.

## Estrutura

```
├── api/index.js        ← entrada da API na Vercel
├── server/
│   ├── app.js          ← rotas da API (público + painel)
│   ├── store.js        ← dados: Redis na Vercel, data/db.json no computador
│   └── auth.js         ← login (senha criptografada + cookie assinado)
├── data/db.json        ← dados iniciais (copiados para o Redis no primeiro acesso)
├── public/             ← tudo que o navegador acessa
│   ├── index.html, servicos.html, agendamento.html, sobre.html, 404.html
│   ├── style.css, script.js
│   ├── robots.txt, sitemap.xml, favicon.png
│   ├── imagens/
│   └── admin/          ← painel (login.html e index.html)
├── server.js           ← servidor para testar no computador
└── vercel.json         ← rotas, subdomínio admin e cabeçalhos
```

## Rodar no computador

```
npm install
npm start
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin/login

Sem configurar nada, o painel salva em `data/db.json` e as fotos em `public/imagens`.
Para definir usuário e senha locais, copie `.env.example` para `.env.local`.

## Variáveis de ambiente (Vercel)

| Nome | Para que serve |
|---|---|
| `ADMIN_USER` | Usuário do painel |
| `ADMIN_PASSWORD` | Senha inicial do painel |
| `SESSION_SECRET` | Texto longo e aleatório para assinar o login |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Criadas ao conectar o Upstash Redis |
| `BLOB_READ_WRITE_TOKEN` | Criada ao conectar o Vercel Blob |

Depois que a senha for trocada pelo painel, ela passa a valer no lugar de `ADMIN_PASSWORD`.
