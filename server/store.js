// Camada de dados.
// Na Vercel: guarda os dados no Redis (Upstash) e as fotos no Vercel Blob.
// No computador (sem essas variáveis): usa o arquivo data/db.json e a pasta public/imagens.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const IMG_DIR = path.join(__dirname, '..', 'public', 'imagens');
const KEY = 'studioale:db';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ON_VERCEL = !!process.env.VERCEL;

let redis = null;
if (REDIS_URL && REDIS_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
}

class StorageError extends Error {}

function lerArquivo() {
  // require garante que a Vercel inclua o db.json no deploy
  delete require.cache[require.resolve(DB_FILE)];
  return JSON.parse(JSON.stringify(require(DB_FILE)));
}

async function lerDB() {
  if (redis) {
    const db = await redis.get(KEY);
    if (db) return db;
    // Primeira vez: copia os dados iniciais do db.json para o Redis
    const inicial = lerArquivo();
    await redis.set(KEY, inicial);
    return inicial;
  }
  return lerArquivo();
}

async function salvarDB(db) {
  if (redis) {
    await redis.set(KEY, db);
    return;
  }
  if (ON_VERCEL) {
    throw new StorageError(
      'Banco de dados não configurado. Conecte o Upstash Redis no painel da Vercel (Storage).'
    );
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

async function salvarImagem(buffer, nomeArquivo, contentType) {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    const { put } = require('@vercel/blob');
    const blob = await put(`servicos/${nomeArquivo}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  }
  if (ON_VERCEL) {
    throw new StorageError(
      'Armazenamento de imagens não configurado. Conecte o Vercel Blob no painel da Vercel (Storage).'
    );
  }
  fs.writeFileSync(path.join(IMG_DIR, nomeArquivo), buffer);
  return '/imagens/' + nomeArquivo;
}

module.exports = { lerDB, salvarDB, salvarImagem, StorageError, usandoRedis: !!redis };
