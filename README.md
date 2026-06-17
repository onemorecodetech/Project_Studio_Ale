# Studio Alessandra — Site + Painel Admin

## Como rodar

### 1. Instalar dependências
Abra o terminal dentro desta pasta e execute:
```
npm install
```

### 2. Iniciar o servidor
```
node server.js
```

### 3. Acessar

| O quê | Endereço |
|---|---|
| Site público | http://localhost:3000 |
| Painel admin | http://localhost:3000/admin/login |

---

## Login padrão do painel

- **Usuário:** `alessandra`
- **Senha:** `studio2024`

> ⚠️ Altere a senha após o primeiro acesso pelo menu "Senha" do painel!

---

## O que a Alessandra pode fazer no painel

- **Serviços** — editar nome, preço, descrição, foto e ativar/desativar serviços
- **Horários** — configurar dias e horários de atendimento
- **Promoções** — criar, pausar e excluir promoções (aparecem em banner no site)
- **Contato** — atualizar links do Instagram, WhatsApp e agendamento
- **Senha** — alterar a senha de acesso ao painel

---

## Estrutura de arquivos

```
studio_alessandra/
├── server.js          ← servidor Express
├── package.json
├── data/
│   └── db.json        ← banco de dados (editar com cuidado)
├── public/            ← site público
│   ├── index.html
│   ├── servicos.html
│   ├── agendamento.html
│   ├── sobre.html
│   ├── style.css
│   └── imagens/
└── admin/             ← painel administrativo
    ├── login.html
    └── index.html
```
