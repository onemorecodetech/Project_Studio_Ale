const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');

const app = express();
const DB_PATH = path.join(__dirname, 'data/db.json');

// ── Helpers ──────────────────────────────────────────────
function lerDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function salvarDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Middlewares ───────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(session({
  secret: 'studio-alessandra-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));

// Upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/imagens')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `servico_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── Auth middleware ───────────────────────────────────────
function autenticado(req, res, next) {
  if (req.session && req.session.logado) return next();
  res.status(401).json({ erro: 'Não autorizado' });
}

// ── Rotas públicas (API para o site) ─────────────────────
app.get('/api/dados', (req, res) => {
  const db = lerDB();
  res.json({
    servicos: db.servicos.filter(s => s.ativo),
    horarios: db.horarios,
    promocoes: db.promocoes,
    contato: db.contato
  });
});

// ── Rotas de autenticação ─────────────────────────────────
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  const db = lerDB();
  if (usuario === db.admin.usuario && senha === db.admin.senha) {
    req.session.logado = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ erro: 'Usuário ou senha incorretos' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/sessao', (req, res) => {
  res.json({ logado: !!(req.session && req.session.logado) });
});

// ── Rotas admin — Serviços ────────────────────────────────
app.get('/api/admin/servicos', autenticado, (req, res) => {
  const db = lerDB();
  res.json(db.servicos);
});

app.put('/api/admin/servicos/:id', autenticado, (req, res) => {
  const db = lerDB();
  const id = parseInt(req.params.id);
  const idx = db.servicos.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ erro: 'Serviço não encontrado' });
  db.servicos[idx] = { ...db.servicos[idx], ...req.body, id };
  salvarDB(db);
  res.json({ ok: true, servico: db.servicos[idx] });
});

app.post('/api/admin/servicos/:id/foto', autenticado, upload.single('foto'), (req, res) => {
  const db = lerDB();
  const id = parseInt(req.params.id);
  const idx = db.servicos.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ erro: 'Serviço não encontrado' });
  db.servicos[idx].foto = '/imagens/' + req.file.filename;
  salvarDB(db);
  res.json({ ok: true, foto: db.servicos[idx].foto });
});

// ── Rotas admin — Horários ────────────────────────────────
app.get('/api/admin/horarios', autenticado, (req, res) => {
  res.json(lerDB().horarios);
});

app.put('/api/admin/horarios', autenticado, (req, res) => {
  const db = lerDB();
  db.horarios = req.body;
  salvarDB(db);
  res.json({ ok: true });
});

// ── Rotas admin — Promoções ───────────────────────────────
app.get('/api/admin/promocoes', autenticado, (req, res) => {
  res.json(lerDB().promocoes);
});

app.post('/api/admin/promocoes', autenticado, (req, res) => {
  const db = lerDB();
  const nova = { id: Date.now(), ...req.body, ativo: true };
  db.promocoes.push(nova);
  salvarDB(db);
  res.json({ ok: true, promocao: nova });
});

app.put('/api/admin/promocoes/:id', autenticado, (req, res) => {
  const db = lerDB();
  const id = parseInt(req.params.id);
  const idx = db.promocoes.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ erro: 'Promoção não encontrada' });
  db.promocoes[idx] = { ...db.promocoes[idx], ...req.body, id };
  salvarDB(db);
  res.json({ ok: true });
});

app.delete('/api/admin/promocoes/:id', autenticado, (req, res) => {
  const db = lerDB();
  const id = parseInt(req.params.id);
  db.promocoes = db.promocoes.filter(p => p.id !== id);
  salvarDB(db);
  res.json({ ok: true });
});

// ── Rotas admin — Contato ─────────────────────────────────
app.get('/api/admin/contato', autenticado, (req, res) => {
  res.json(lerDB().contato);
});

app.put('/api/admin/contato', autenticado, (req, res) => {
  const db = lerDB();
  db.contato = { ...db.contato, ...req.body };
  salvarDB(db);
  res.json({ ok: true });
});

// ── Rotas admin — Senha ───────────────────────────────────
app.put('/api/admin/senha', autenticado, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const db = lerDB();
  if (senhaAtual !== db.admin.senha) return res.status(401).json({ erro: 'Senha atual incorreta' });
  db.admin.senha = novaSenha;
  salvarDB(db);
  res.json({ ok: true });
});

// ── Páginas HTML ──────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin/index.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'admin/login.html')));

// ── Start ─────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🌸 Studio Alessandra rodando!`);
  console.log(`   Site público:  http://localhost:${PORT}`);
  console.log(`   Painel admin:  http://localhost:${PORT}/admin/login\n`);
});
