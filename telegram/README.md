# Bot de Telegram — El Misterio del Pueblo

Bot de ejemplo **sin dependencias** (solo Node.js) que abre el juego como
**Telegram Mini App** y permite recibir **Telegram Stars** y **crypto (TON)**.

## 1) Publica el juego (GitHub Pages)

Sube el repo a GitHub → **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Tu URL será `https://<usuario>.github.io/<repo>/`.

> ⚠️ La Mini App **requiere HTTPS** (GitHub Pages ya lo da). Si pruebas en local,
> usa un túnel HTTPS (p. ej. `cloudflared tunnel` o `ngrok`).

## 2) Crea el bot

1. En Telegram, abre **@BotFather** → `/newbot` → guarda el **token**.
2. (Opcional) `/setmenubutton` → elige el bot → pega la URL del juego → así aparece el
   botón de menú "🎮" siempre visible.
3. (Opcional) `/newapp` para crear una Mini App con nombre y URL.

## 3) Ejecuta el bot

```bash
cd telegram
BOT_TOKEN="123456:ABC-DEF..." \
WEBAPP_URL="https://<usuario>.github.io/<repo>/" \
PRICE_STARS=50 \
CRYPTO_ADDRESS="UQ..." \
node bot.js
```

Variables:

| Var | Descripción | Default |
|---|---|---|
| `BOT_TOKEN` | Token de @BotFather | — (obligatorio) |
| `WEBAPP_URL` | URL HTTPS del juego | — |
| `PRICE_STARS` | Precio del desbloqueo en Stars | `50` |
| `CRYPTO_ADDRESS` | Dirección TON para pagos crypto | — |
| `CRYPTO_NANO` | Importe crypto en nanoTON (1 TON = 1e9) | `1000000000` |

## 4) Comandos del bot

- `/start` — bienvenida + botón **Jugar**.
- `/play` — abre la Mini App.
- `/pagar` — tienda: **Stars** (`sendInvoice`, moneda `XTR`) y **crypto TON**.
- `/help` — ayuda y controles.

## Cómo funcionan los pagos

- **Telegram Stars:** `sendInvoice` con `currency: 'XTR'` y **sin** `provider_token`.
  El bot responde `pre_checkout_query` con `ok:true` y confirma en `successful_payment`.
- **Crypto (TON):** se genera un enlace `ton://transfer/<direccion>?amount=<nanoTON>`
  que abre el monedero del usuario. Para verificación automática on-chain necesitarías
  consultar un indexador de TON (p. ej. TON API) y comparar el `memo`/importe.

## Nota para producción

- Deploy 24/7: `systemd`, `pm2` o un VPS. `node bot.js` es suficiente para empezar.
- Para guardar compras/usuarios usa una base de datos (SQLite/Postgres).
