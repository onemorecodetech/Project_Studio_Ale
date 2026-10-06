// Servidor para rodar no computador: npm install && npm start
// Na Vercel este arquivo não é usado (lá a API roda em api/index.js e as páginas saem da pasta public).
const express = require('express');
const path = require('path');

// Carrega o .env.local se existir (sem dependências extras)
try { process.loadEnvFile(path.join(__dirname, '.env.local')); } catch {}

const api = require('./server/app');
const app = express();
const PUBLIC = path.join(__dirname, 'public');

app.use(api);
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(PUBLIC, 'admin', 'index.html')));
app.use(express.static(PUBLIC, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, '404.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 Studio Alessandra rodando!`);
  console.log(`   Site:   http://localhost:${PORT}`);
  console.log(`   Painel: http://localhost:${PORT}/admin/login\n`);
});
