// API do Studio Alessandra (usada pela Vercel em api/index.js e pelo server.js local)
const express = require('express');
const multer = require('multer');
const path = require('path');
const { lerDB, salvarDB, salvarImagem, StorageError } = require('./store');
const auth = require('./auth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const ON_VERCEL = !!process.env.VERCEL;
const ADMIN_USER = process.env.ADMIN_USER || 'alessandra';
const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // limite da Vercel é 4,5 MB por requisição
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

// Envolve rotas async para os erros chegarem ao tratador no final
const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const texto = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const semAdmin = ({ admin, ...resto }) => resto;

// ── Autenticação ──────────────────────────────────────────
const autenticado = rota(async (req, res, next) => {
  const sessao = auth.lerToken(auth.lerCookie(req));
  if (!sessao) return res.status(401).json({ erro: 'Não autorizado' });
  const db = await lerDB();
  if ((db.admin?.versao || 0) !== sessao.v) return res.status(401).json({ erro: 'Sessão expirada' });
  req.db = db;
  next();
});

function senhaConfere(db, senha) {
  if (db.admin?.hash) return auth.conferirHash(senha, db.admin.hash);
  if (process.env.ADMIN_PASSWORD) return auth.iguais(senha, process.env.ADMIN_PASSWORD);
  if (!ON_VERCEL) return auth.iguais(senha, 'Studio2026'); // padrão só para testes locais
  return false;
}

app.post('/api/login', rota(async (req, res) => {
  if (!auth.SECRET) {
    return res.status(503).json({ erro: 'Login não configurado: falta a variável SESSION_SECRET na Vercel.' });
  }
  const usuario = texto(req.body.usuario, 100);
  const senha = String(req.body.senha || '');
  const db = await lerDB();
  if (!auth.iguais(usuario, ADMIN_USER) || !senhaConfere(db, senha)) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
  }
  auth.definirCookie(res, auth.criarToken(db.admin?.versao || 0), req);
  res.json({ ok: true });
}));

app.post('/api/logout', (req, res) => {
  auth.definirCookie(res, null, req);
  res.json({ ok: true });
});

app.get('/api/sessao', rota(async (req, res) => {
  const sessao = auth.lerToken(auth.lerCookie(req));
  let logado = false;
  if (sessao) {
    const db = await lerDB();
    logado = (db.admin?.versao || 0) === sessao.v;
  }
  res.set('Cache-Control', 'no-store').json({ logado });
}));

// ── Público ───────────────────────────────────────────────
app.get('/api/dados', rota(async (req, res) => {
  const db = await lerDB();
  res.set('Cache-Control', 'no-store').json({
    servicos: db.servicos.filter((s) => s.ativo),
    horarios: db.horarios,
    promocoes: db.promocoes.filter((p) => p.ativo),
    contato: db.contato,
  });
}));

// ── Admin: serviços ───────────────────────────────────────
app.get('/api/admin/servicos', autenticado, (req, res) => res.json(req.db.servicos));

app.put('/api/admin/servicos/:id', autenticado, rota(async (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const idx = db.servicos.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ erro: 'Serviço não encontrado' });
  const { nome, preco, descricao, ativo } = req.body;
  db.servicos[idx] = {
    ...db.servicos[idx],
    ...(nome !== undefined && { nome: texto(nome, 120) }),
    ...(preco !== undefined && { preco: texto(preco, 60) }),
    ...(descricao !== undefined && { descricao: texto(descricao, 1000) }),
    ...(ativo !== undefined && { ativo: !!ativo }),
  };
  await salvarDB(db);
  res.json({ ok: true, servico: db.servicos[idx] });
}));

app.post('/api/admin/servicos/:id/foto', autenticado, upload.single('foto'), rota(async (req, res) => {
  const db = req.db;
  const id = parseInt(req.params.id, 10);
  const idx = db.servicos.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ erro: 'Serviço não encontrado' });
  if (!req.file) return res.status(400).json({ erro: 'Envie uma imagem JPG, PNG ou WEBP' });
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[req.file.mimetype];
  db.servicos[idx].foto = await salvarImagem(req.file.buffer, `servico_${id}_${Date.now()}${ext}`, req.file.mimetype);
  await salvarDB(db);
  res.json({ ok: true, foto: db.servicos[idx].foto });
}));

// ── Admin: horários ───────────────────────────────────────
app.get('/api/admin/horarios', autenticado, (req, res) => res.json(req.db.horarios));

app.put('/api/admin/horarios', autenticado, rota(async (req, res) => {
  const hora = (v) => (/^\d{2}:\d{2}$/.test(v) ? v : '');
  const horarios = {};
  for (const dia of DIAS) {
    const d = req.body[dia] || {};
    horarios[dia] = { ativo: !!d.ativo, abertura: hora(d.abertura), fechamento: hora(d.fechamento) };
  }
  req.db.horarios = horarios;
  await salvarDB(req.db);
  res.json({ ok: true });
}));

// ── Admin: promoções ──────────────────────────────────────
app.get('/api/admin/promocoes', autenticado, (req, res) => res.json(req.db.promocoes));

app.post('/api/admin/promocoes', autenticado, rota(async (req, res) => {
  const nova = { id: Date.now(), titulo: texto(req.body.titulo, 120), descricao: texto(req.body.descricao, 300), ativo: true };
  if (!nova.titulo) return res.status(400).json({ erro: 'Informe o título da promoção' });
  req.db.promocoes.push(nova);
  await salvarDB(req.db);
  res.json({ ok: true, promocao: nova });
}));

app.put('/api/admin/promocoes/:id', autenticado, rota(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const promo = req.db.promocoes.find((p) => p.id === id);
  if (!promo) return res.status(404).json({ erro: 'Promoção não encontrada' });
  if (req.body.titulo !== undefined) promo.titulo = texto(req.body.titulo, 120);
  if (req.body.descricao !== undefined) promo.descricao = texto(req.body.descricao, 300);
  if (req.body.ativo !== undefined) promo.ativo = !!req.body.ativo;
  await salvarDB(req.db);
  res.json({ ok: true });
}));

app.delete('/api/admin/promocoes/:id', autenticado, rota(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  req.db.promocoes = req.db.promocoes.filter((p) => p.id !== id);
  await salvarDB(req.db);
  res.json({ ok: true });
}));

// ── Admin: contato ────────────────────────────────────────
app.get('/api/admin/contato', autenticado, (req, res) => res.json(req.db.contato));

app.put('/api/admin/contato', autenticado, rota(async (req, res) => {
  const { instagram, whatsapp, agendamento } = req.body;
  req.db.contato = {
    ...req.db.contato,
    ...(instagram !== undefined && { instagram: texto(instagram, 300) }),
    ...(whatsapp !== undefined && { whatsapp: texto(whatsapp, 20).replace(/\D/g, '') }),
    ...(agendamento !== undefined && { agendamento: texto(agendamento, 300) }),
  };
  await salvarDB(req.db);
  res.json({ ok: true });
}));

// ── Admin: senha ──────────────────────────────────────────
app.put('/api/admin/senha', autenticado, rota(async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const db = req.db;
  if (!senhaConfere(db, String(senhaAtual || ''))) return res.status(401).json({ erro: 'Senha atual incorreta' });
  if (String(novaSenha || '').length < 6) return res.status(400).json({ erro: 'A nova senha precisa ter no mínimo 6 caracteres' });
  const versao = (db.admin?.versao || 0) + 1;
  db.admin = { hash: auth.hashSenha(String(novaSenha)), versao };
  await salvarDB(db);
  auth.definirCookie(res, auth.criarToken(versao), req); // mantém logado neste aparelho
  res.json({ ok: true });
}));

// ── Erros ─────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

app.use((err, req, res, next) => {
  if (err instanceof StorageError) return res.status(503).json({ erro: err.message });
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande (máximo 4 MB)' : 'Erro no envio da imagem';
    return res.status(400).json({ erro: msg });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
