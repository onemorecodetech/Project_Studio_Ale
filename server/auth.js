// Login sem dependências: senha com scrypt e sessão num cookie assinado.
// Funciona na Vercel, onde o servidor não guarda nada na memória entre requisições.
const crypto = require('crypto');

const COOKIE = 'sa_sessao';
const DURACAO_MS = 1000 * 60 * 60 * 8; // 8 horas
const ON_VERCEL = !!process.env.VERCEL;

// No computador, se não houver SESSION_SECRET, gera uma chave temporária
const SECRET = process.env.SESSION_SECRET || (ON_VERCEL ? null : crypto.randomBytes(32).toString('hex'));

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function conferirHash(senha, armazenado) {
  const [salt, hash] = String(armazenado).split(':');
  if (!salt || !hash) return false;
  const teste = crypto.scryptSync(senha, salt, 64);
  const original = Buffer.from(hash, 'hex');
  return original.length === teste.length && crypto.timingSafeEqual(original, teste);
}

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function assinar(valor) {
  return crypto.createHmac('sha256', SECRET).update(valor).digest('base64url');
}

function criarToken(versao) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DURACAO_MS, v: versao })).toString('base64url');
  return `${payload}.${assinar(payload)}`;
}

function lerToken(token) {
  if (!SECRET || !token) return null;
  const [payload, assinatura] = token.split('.');
  if (!payload || !assinatura || !iguais(assinatura, assinar(payload))) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return dados.exp > Date.now() ? dados : null;
  } catch {
    return null;
  }
}

function lerCookie(req) {
  const header = req.headers.cookie || '';
  const par = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  return par ? decodeURIComponent(par.slice(COOKIE.length + 1)) : null;
}

function definirCookie(res, token, req) {
  const seguro = req.headers['x-forwarded-proto'] === 'https' || req.secure;
  const partes = [
    `${COOKIE}=${token ? encodeURIComponent(token) : ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${token ? DURACAO_MS / 1000 : 0}`,
  ];
  if (seguro) partes.push('Secure');
  res.setHeader('Set-Cookie', partes.join('; '));
}

module.exports = { hashSenha, conferirHash, iguais, criarToken, lerToken, lerCookie, definirCookie, SECRET };
