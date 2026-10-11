// Limite de tentativas de login (contra quem tenta adivinhar a senha).
// Na Vercel usa o Redis (vale para todos os servidores); no computador, a memória.
const memoria = new Map();

let redis = null;
function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redis) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url, token });
  }
  return redis;
}

function ipDe(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  return fwd.split(',')[0].trim() || req.socket?.remoteAddress || 'desconhecido';
}

async function registrarTentativa(chave, { maximo, minutos }) {
  const k = `studioale:limite:${chave}`;
  const janela = minutos * 60;
  const r = getRedis();
  if (r) {
    const total = await r.incr(k);
    if (total === 1) await r.expire(k, janela);
    const ttl = total > maximo ? await r.ttl(k) : 0;
    return { bloqueado: total > maximo, restante: Math.ceil(Math.max(ttl, 60) / 60) };
  }
  const agora = Date.now();
  const atual = memoria.get(k);
  if (!atual || atual.ate < agora) {
    memoria.set(k, { total: 1, ate: agora + janela * 1000 });
    return { bloqueado: false, restante: 0 };
  }
  atual.total += 1;
  return { bloqueado: atual.total > maximo, restante: Math.ceil((atual.ate - agora) / 60000) };
}

async function limparTentativas(chave) {
  const k = `studioale:limite:${chave}`;
  const r = getRedis();
  if (r) await r.del(k);
  else memoria.delete(k);
}

module.exports = { ipDe, registrarTentativa, limparTentativas };
