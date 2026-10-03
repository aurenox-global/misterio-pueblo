/**
 * Bot de Telegram para "El Misterio del Pueblo — Pixel Ghosts".
 * Sin dependencias: solo Node.js (https) — polling + payments.
 *
 *   Uso:
 *     BOT_TOKEN="123:ABC" WEBAPP_URL="https://usuario.github.io/repo/" \
 *     PRICE_STARS=50 CRYPTO_ADDRESS="UQ..." node bot.js
 *
 *   Env:
 *     BOT_TOKEN        token de @BotFather (obligatorio)
 *     WEBAPP_URL       URL HTTPS del juego (GitHub Pages) — obligatorio para la Mini App
 *     PRICE_STARS      precio en Telegram Stars para el "desbloqueo premium" (default 50)
 *     CRYPTO_ADDRESS   dirección TON para pagos en crypto (opcional)
 *     CRYPTO_NANO      cantidad en nanoTON (1 TON = 1e9) para el botón crypto (default 1 TON)
 */
'use strict';
const https = require('https');

const TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const PRICE_STARS = parseInt(process.env.PRICE_STARS || '50', 10);
const CRYPTO_ADDRESS = process.env.CRYPTO_ADDRESS || '';
const CRYPTO_NANO = process.env.CRYPTO_NANO || '1000000000'; // 1 TON

if (!TOKEN) { console.error('Falta BOT_TOKEN'); process.exit(1); }

/* ------------------------- cliente mínimo de la API ----------------------- */
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

/* --------------------------------- teclados -------------------------------- */
const kbPlay = () => ({
  inline_keyboard: [[{ text: '🎮 Jugar ahora', web_app: { url: WEBAPP_URL } }]]
});
function kbShop() {
  const rows = [
    [{ text: `⭐ Premium (${PRICE_STARS} Stars)`, callback_data: 'buy_stars' }],
    [{ text: '❓ Ayuda', callback_data: 'help' }]
  ];
  if (CRYPTO_ADDRESS) rows.splice(1, 0, [{ text: '💎 Pagar en TON (crypto)', callback_data: 'buy_crypto' }]);
  return { inline_keyboard: rows };
}

/* ------------------------------- handlers --------------------------------- */
async function send(chatId, text, extra) {
  return api('sendMessage', Object.assign({ chat_id: chatId, text, parse_mode: 'HTML' }, extra || {}));
}

async function onStart(msg) {
  const name = msg.from.first_name || 'investigador';
  await send(msg.chat.id,
    `👻 <b>El Misterio del Pueblo</b>\n\n` +
    `Bienvenido, <b>${name}</b>. Reúne <b>5 pistas</b>, esquiva a los fantasmas y ` +
    `resuelve el misterio de Valdemora.\n\n` +
    `Comandos:\n` +
    `/play — abrir el juego\n` +
    `/pagar — apoyar el proyecto (Stars / crypto)\n` +
    `/help — ayuda\n`,
    kbPlay());
}

async function onHelp(msg) {
  await send(msg.chat.id,
    `🎮 <b>Controles</b>\n` +
    `· WASD / flechas: mover\n` +
    `· E: interactuar (recoger, abrir puertas)\n` +
    `· F: linterna (ahuyenta fantasmas, gasta batería)\n` +
    `· N: nueva partida (en el título)\n\n` +
    `🎯 Junta 5 pistas y llega a la mansión central.`,
    WEBAPP_URL ? kbPlay() : undefined);
}

function cryptoUrl() {
  return `ton://transfer/${CRYPTO_ADDRESS}?amount=${CRYPTO_NANO}`;
}

async function buyStars(chatId) {
  await api('sendInvoice', {
    chat_id: chatId,
    title: 'El Misterio del Pueblo — Premium',
    description: `Desbloquea contenido extra y apoya el desarrollo (${PRICE_STARS} Stars).`,
    payload: 'premium_unlock',
    currency: 'XTR',                     // Telegram Stars
    prices: [{ label: 'Premium', amount: PRICE_STARS }]
    // En XTR NO se envía provider_token.
  });
}

async function buyCrypto(chatId) {
  if (!CRYPTO_ADDRESS) return send(chatId, 'Crypto no configurado.');
  await send(chatId,
    `💎 <b>Pago en TON</b>\nEnvíanos <b>${(Number(CRYPTO_NANO) / 1e9).toFixed(2)} TON</b> a:\n<code>${CRYPTO_ADDRESS}</code>\n\nAl pagar, la app se desbloquea.`,
    { inline_keyboard: [[{ text: '💎 Abrir monedero TON', url: cryptoUrl() }]] });
}

/* ------------------------------ long polling ------------------------------ */
let offset = 0;
async function poll() {
  try {
    const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] });
    for (const u of updates) {
      offset = u.update_id + 1;
      try { await handleUpdate(u); } catch (e) { console.error('handler:', e.message); }
    }
  } catch (e) {
    console.error('poll:', e.message);
    await new Promise(r => setTimeout(r, 2000));
  }
  setImmediate(poll);
}

async function handleUpdate(u) {
  // 1) confirmación previa al pago
  if (u.pre_checkout_query) {
    await api('answerPreCheckoutQuery', { pre_checkout_query_id: u.pre_checkout_query.id, ok: true });
    return;
  }
  // 2) botones inline
  if (u.callback_query) {
    const cq = u.callback_query;
    await api('answerCallbackQuery', { callback_query_id: cq.id });
    if (cq.data === 'buy_stars') return buyStars(cq.message.chat.id);
    if (cq.data === 'buy_crypto') return buyCrypto(cq.message.chat.id);
    if (cq.data === 'help') return onHelp(cq.message);
    return;
  }
  // 3) mensajes
  const m = u.message;
  if (!m) return;
  // pago completado
  if (m.successful_payment) {
    return send(m.chat.id,
      `✅ <b>¡Gracias por tu apoyo!</b>\nPago recibido: ${m.successful_payment.total_amount} Stars.\n`,
      WEBAPP_URL ? kbPlay() : undefined);
  }
  const text = (m.text || '').trim();
  const cmd = text.split(' ')[0].toLowerCase();
  if (cmd === '/start') return onStart(m);
  if (cmd === '/play' || cmd === '/jugar') {
    if (!WEBAPP_URL) return send(m.chat.id, 'Configura WEBAPP_URL con la URL HTTPS del juego.');
    return send(m.chat.id, '🎮 ¡Suerte en Valdemora!', kbPlay());
  }
  if (cmd === '/pagar' || cmd === '/premium' || cmd === '/tienda') {
    return send(m.chat.id, '⭐ Elige cómo apoyar el proyecto:', kbShop());
  }
  if (cmd === '/help' || cmd === '/ayuda') return onHelp(m);
  // cualquier otro texto
  return send(m.chat.id, 'Usa /play para jugar o /help para ver los comandos.', WEBAPP_URL ? kbPlay() : undefined);
}

(async () => {
  const me = await api('getMe', {});
  console.log(`Bot @${me.username} en marcha${WEBAPP_URL ? ' · WebApp: ' + WEBAPP_URL : ''}`);
  poll();
})();
