/**
 * Bot de Telegram — "El Misterio del Pueblo — Pixel Ghosts".
 * Sin dependencias: solo Node.js (https/fs) — long polling + pagos + ranking.
 *
 *   UI 100% por BOTONES inline (menú), sin necesidad de escribir comandos.
 *   Arranque (systemd): EnvironmentFile=bot.env
 *
 *   Env:
 *     BOT_TOKEN        token de @BotFather (obligatorio)
 *     WEBAPP_URL       URL HTTPS del juego (GitHub Pages)
 *     PRICE_STARS      precio en Telegram Stars del desbloqueo premium (default 50)
 *     CRYPTO_ADDRESS   dirección TON para el pago crypto (opcional)
 *     CRYPTO_NANO      cantidad en nanoTON (1 TON = 1e9)
 *     DATA_DIR         carpeta de datos persistentes (default: carpeta del bot)
 */
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env['BOT' + '_TOKEN'];
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://aurenox-global.github.io/misterio-pueblo/';
const PRICE_STARS = parseInt(process.env.PRICE_STARS || '50', 10);
const CRYPTO_ADDRESS = process.env.CRYPTO_ADDRESS || '';
const CRYPTO_NANO = process.env.CRYPTO_NANO || '1000000000'; // 1 TON
const DATA_DIR = process.env.DATA_DIR || __dirname;

if (!TOKEN) { console.error('Falta BOT_TOKEN'); process.exit(1); }

/* ============================== PERSISTENCIA ============================== */
const DB_FILE = path.join(DATA_DIR, 'purchases.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
let db = { users: {} };   // users[uid] = { first_name, purchases:[{at,stars,payload}] }
let scores = {};          // scores[uid] = { name, clues, sanity, at }

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) || def; }
  catch (e) { console.error('load', file, e.message); }
  return def;
}
function saveJSON(file, obj) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) { console.error('save', file, e.message); }
}
function recordPurchase(from, stars, payload) {
  const uid = String(from.id);
  const u = db.users[uid] || (db.users[uid] = { first_name: from.first_name || '', purchases: [] });
  u.first_name = from.first_name || u.first_name;
  u.purchases.push({ at: new Date().toISOString(), stars, payload: payload || 'premium_unlock' });
  saveJSON(DB_FILE, db);
}
function userPurchases(uid) { const u = db.users[String(uid)]; return u ? u.purchases : []; }
function totalStars(uid) { return userPurchases(uid).reduce((a, p) => a + (p.stars || 0), 0); }

function submitScore(from, data) {
  const uid = String(from.id);
  const name = (from.first_name || 'Anónimo').slice(0, 24);
  const clues = Math.max(0, Math.min(5, parseInt(data.clues, 10) || 0));
  const sanity = Math.max(0, Math.min(100, parseInt(data.sanity, 10) || 0));
  const prev = scores[uid];
  const better = !prev || clues > prev.clues || (clues === prev.clues && sanity > (prev.sanity || 0));
  if (better) scores[uid] = { name, clues, sanity, at: Date.now() };
  saveJSON(SCORES_FILE, scores);
  return { entry: scores[uid], improved: better, clues, sanity };
}
function rankingList() {
  return Object.entries(scores)
    .map(([uid, s]) => ({ uid, ...s }))
    .sort((a, b) => (b.clues - a.clues) || (b.sanity - a.sanity) || (a.at - b.at))
    .slice(0, 10);
}

/* ============================== API mínima ================================ */
function api(method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { const j = JSON.parse(data); j.ok ? resolve(j.result) : reject(new Error(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}
const send = (chatId, text, extra) =>
  api('sendMessage', Object.assign({ chat_id: chatId, text, parse_mode: 'HTML' }, extra || {}));

async function show(chatId, messageId, text, kb) {
  // edita el mensaje si podemos; si no, envía uno nuevo
  if (messageId) {
    try {
      return await api('editMessageText', {
        chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup: kb
      });
    } catch (e) { /* mensaje muy viejo o idéntico -> enviamos nuevo */ }
  }
  return send(chatId, text, kb);
}

/* =============================== PANTALLAS ================================ */
const back = [{ text: '⬅️ Menú', callback_data: 'menu' }];
const kbMain = () => ({
  inline_keyboard: [
    [{ text: '🎮 Jugar ahora', web_app: { url: WEBAPP_URL } }],
    [{ text: '⭐ Premium', callback_data: 'premium' }, { text: '🧾 Mi historial', callback_data: 'historial' }],
    [{ text: '🏆 Ranking', callback_data: 'ranking' }, { text: '❓ Ayuda', callback_data: 'ayuda' }]
  ]
});
function kbPremium() {
  const rows = [[{ text: `⭐ Comprar Premium (${PRICE_STARS} Stars)`, callback_data: 'buy_stars' }]];
  if (CRYPTO_ADDRESS) rows.push([{ text: '💎 Pagar en TON', callback_data: 'buy_crypto' }]);
  rows.push(back);
  return { inline_keyboard: rows };
}

const T_START = (name) =>
  `👻 <b>El Misterio del Pueblo</b>\n\n` +
  `Bienvenido, <b>${name}</b>. Reúne <b>5 pistas</b>, esquiva a los fantasmas y ` +
  `resuelve el misterio de Valdemora.\n\n` +
  `Usa los <b>botones</b> de abajo 👇`;
const T_AYUDA =
  `🎮 <b>Controles</b>\n` +
  `· WASD / flechas: mover\n` +
  `· E: interactuar (recoger, abrir puertas)\n` +
  `· F: linterna (ahuyenta fantasmas, gasta batería)\n` +
  `· N: nueva partida (en el título)\n\n` +
  `🎯 Junta 5 pistas y llega a la mansión central.`;

const T_PREMIUM_OFF = () =>
  `⭐ <b>Premium</b>\n\nAún no eres premium.\nApóyanos con <b>${PRICE_STARS} Stars</b> y desbloquea contenido extra.`;
const T_PREMIUM_ON = (total) =>
  `⭐ <b>Premium activo</b>\n\nHas aportado <b>${total} Stars</b>. ¡Gracias! Disfruta del contenido extra.`;

function tHistorial(uid) {
  const ps = userPurchases(uid);
  if (!ps.length) return `🧾 <b>Mi historial</b>\n\nTodavía no has hecho ningún pago. Pulsa ⭐ Premium para apoyar el proyecto.`;
  const lines = ps.slice(-10).map(p => `· ${new Date(p.at).toLocaleString('es-ES')} — ⭐ ${p.stars}`);
  return `🧾 <b>Mis pagos</b> (${ps.length})\n` + lines.join('\n') + `\n\nTotal: <b>${totalStars(uid)} ⭐</b>`;
}
function tRanking() {
  const list = rankingList();
  if (!list.length) return `🏆 <b>Ranking</b>\n\nTodavía no hay puntuaciones.\n¡Juega y pulsa <b>Enviar puntuación</b> al terminar!`;
  const medal = ['🥇', '🥈', '🥉'];
  const lines = list.map((r, i) => `${medal[i] || (i + 1) + '.'} <b>${r.name}</b> — ${r.clues}/5 pistas · ${r.sanity}% cordura`);
  return `🏆 <b>Ranking</b>\n\n` + lines.join('\n');
}

/* =============================== ACCIONES ================================= */
async function buyStars(chatId) {
  await api('sendInvoice', {
    chat_id: chatId,
    title: 'El Misterio del Pueblo — Premium',
    description: `Desbloquea contenido extra y apoya el desarrollo (${PRICE_STARS} Stars).`,
    payload: 'premium_unlock',
    currency: 'XTR',
    prices: [{ label: 'Premium', amount: PRICE_STARS }]
  });
}
async function buyCrypto(chatId, messageId) {
  if (!CRYPTO_ADDRESS) return show(chatId, messageId, 'Crypto no configurado.', { inline_keyboard: [back] });
  const url = `ton://transfer/${CRYPTO_ADDRESS}?amount=${CRYPTO_NANO}`;
  await show(chatId, messageId,
    `💎 <b>Pago en TON</b>\n\nEnvía <b>${(Number(CRYPTO_NANO) / 1e9).toFixed(2)} TON</b> a:\n<code>${CRYPTO_ADDRESS}</code>\n\nAl pagar, la app se desbloquea.`,
    { inline_keyboard: [[{ text: '💎 Abrir monedero TON', url }], back] });
}
function screen(which, from) {
  switch (which) {
    case 'premium': {
      const total = totalStars(from.id);
      return total > 0 ? { text: T_PREMIUM_ON(total), kb: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }], back] } }
                       : { text: T_PREMIUM_OFF(), kb: kbPremium() };
    }
    case 'historial': return { text: tHistorial(from.id), kb: { inline_keyboard: [back] } };
    case 'ranking': return { text: tRanking(), kb: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }], back] } };
    case 'ayuda': return { text: T_AYUDA, kb: { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }], back] } };
    default: return { text: T_START(from.first_name || 'investigador'), kb: kbMain() };
  }
}

/* =============================== HANDLERS ================================= */
async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const from = cq.from;
  const data = cq.data || '';
  await api('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
  if (data === 'buy_stars') return buyStars(chatId);
  if (data === 'buy_crypto') return buyCrypto(chatId, messageId);
  const s = screen(data, from);
  return show(chatId, messageId, s.text, s.kb);
}

async function handleMessage(m) {
  const from = m.from || { id: 0, first_name: '' };
  // Puntuación enviada desde la Mini App (Telegram.WebApp.sendData)
  if (m.web_app_data) {
    let data = {};
    try { data = JSON.parse(m.web_app_data.data || '{}'); } catch (e) {}
    const r = submitScore(from, data);
    const head = r.improved ? '🏆 <b>¡Nuevo récord guardado!</b>' : '📝 Puntuación recibida (no mejora tu récord).';
    return send(m.chat.id,
      `${head}\n\nPistas: <b>${r.clues}/5</b> · Cordura: <b>${r.sanity}%</b>\n\n` + tRanking(),
      { inline_keyboard: [[{ text: '🎮 Jugar otra vez', web_app: { url: WEBAPP_URL } }], back] });
  }
  if (m.successful_payment) {
    const sp = m.successful_payment;
    recordPurchase(from, sp.total_amount, sp.invoice_payload);
    return send(m.chat.id,
      `✅ <b>¡Gracias por tu apoyo!</b>\nPago recibido: <b>${sp.total_amount} Stars</b>.\nPremium desbloqueado. 🎮`,
      { inline_keyboard: [[{ text: '🎮 Jugar', web_app: { url: WEBAPP_URL } }], back] });
  }
  const text = (m.text || '').trim();
  const cmd = text.split(' ')[0].toLowerCase().replace(/@.*$/, '');
  if (cmd === '/start' || cmd === '/menu' || !text) {
    return send(m.chat.id, T_START(from.first_name || 'investigador'), kbMain());
  }
  // Comandos antiguos -> siguen funcionando, pero redirigen a botones
  const alias = { '/play': 'menu', '/jugar': 'menu', '/premium': 'premium', '/pagar': 'premium', '/tienda': 'premium',
                  '/ranking': 'ranking', '/mispagos': 'historial', '/historial': 'historial', '/help': 'ayuda', '/ayuda': 'ayuda' };
  if (alias[cmd]) { const s = screen(alias[cmd], from); return send(m.chat.id, s.text, s.kb); }
  return send(m.chat.id, T_START(from.first_name || 'investigador'), kbMain());
}

/* ============================== LONG POLLING ============================== */
let offset = 0;
let running = true;

async function poll() {
  while (running) {
    try {
      const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          if (u.pre_checkout_query) {
            await api('answerPreCheckoutQuery', { pre_checkout_query_id: u.pre_checkout_query.id, ok: true });
          } else if (u.callback_query) {
            await handleCallback(u.callback_query);
          } else if (u.message) {
            await handleMessage(u.message);
          }
        } catch (e) { console.error('handler:', e.message); }
      }
    } catch (e) {
      console.error('poll:', e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/* ================================= ARRANQUE =============================== */
db = loadJSON(DB_FILE, { users: {} });
scores = loadJSON(SCORES_FILE, {});
process.on('SIGTERM', () => { running = false; });
process.on('SIGINT', () => { running = false; });
(async () => {
  const me = await api('getMe', {});
  console.log(`[misterio-bot] @${me.username} en marcha (UI botones) · WebApp: ${WEBAPP_URL} · datos: ${DATA_DIR}`);
  poll();
})();
