# El Misterio del Pueblo — Pixel Ghosts 👻

Mini juego de **misterio en mundo abierto** con fantasmas y estética **pixel art**,
en un **único archivo HTML** (HTML + CSS + JS vanilla, sin librerías ni recursos externos).

> 🎮 Juega: abre `index.html` en el navegador, o publícalo como **Telegram Mini App**.

## 🕹️ Cómo se juega

- Eres un investigador con una linterna en un pueblo abandonado (noche + niebla).
- **Objetivo:** reunir **5 pistas** (diario, llave, foto, medallón, carta) repartidas
  por el mapa, llevarlas a la **mansión central** y resolver el misterio.
- Los **fantasmas** te roban **cordura** al tocarte. Si llega a 0 → *game over*.

### Controles
| Acción | Teclado | Móvil |
|---|---|---|
| Mover | WASD / flechas | joystick táctil |
| Interactuar | `E` | botón **E** |
| Linterna | `F` | botón **F** |
| Partida nueva | `N` (en título) | — |

## 🧠 Sistemas incluidos

- **Mundo abierto** 100×100 tiles con zonas: bosque, cementerio, calles, lago y mansión.
- **Cámara** top-down con scroll suave; solo se dibujan los tiles visibles.
- **Minimapa** con zonas descubiertas y marcador de la mansión.
- **Sprites** 16×16 definidos como matrices de caracteres, dibujados píxel a píxel.
- **Iluminación**: capa de oscuridad con círculo de linterna (con parpadeo) y niebla animada.
- **3 tipos de fantasma**: Errante (persigue), Tímido (se mueve si NO lo iluminas), Guardián
  (protege una pista y se desvanece al recogerla).
- **Linterna** que ahuyenta/ralentiza fantasmas y gasta **batería** (pilas repartidas).
- **HUD**: barra de cordura, batería e indicador de 5 pistas.
- **Cuadros de diálogo** pixelados con texto letra a letra (narrativa en español).
- **Ciclo de ambiente**: la niebla y la agresividad de los fantasmas suben con cada pista.
- **Colisiones AABB** con tiles sólidos y entre jugador y fantasmas.
- **Sonido** con Web Audio API generado por código (viento, pasos, susurros, tono de pista) + botón de silencio.
- **Autoguardado** en `localStorage` (con `try/catch`).
- **Pantallas**: título, juego, game over y final.
- **Responsive**: canvas 240×160 escalado con `image-rendering: pixelated`.

## 🚀 Publicar en GitHub Pages

```bash
# El sitio es estático: basta con subir este repo y activar Pages (rama main, / root).
# URL resultante: https://<usuario>.github.io/<repo>/
```

## 🤖 Telegram Mini App + estrellas / crypto

En la carpeta `telegram/` tienes un bot de ejemplo sin dependencias (`bot.js`) que:

- Abre el juego como **Mini App** (botón Web App apuntando a la URL de GitHub Pages).
- Cobra con **Telegram Stars (XTR)** mediante `sendInvoice` + `pre_checkout_query`.
- Ofrece un pago en **crypto (TON)** mediante enlace de monedero.

```bash
cd telegram
BOT_TOKEN="123:ABC" WEBAPP_URL="https://<usuario>.github.io/<repo>/" PRICE_STARS=50 node bot.js
```

Configura el bot con **@BotFather**: `/newbot`, luego `/setmenubutton` (o `/newapp`) con la
URL del juego. Ver `telegram/README.md` para el paso a paso.

## 💡 Ideas para ampliarlo

1. **Inventario y puzzles de combinación** (usar la llave en objetos, unir medallón + carta
   para abrir una puerta secreta).
2. **Modo por semilla / New Game+** con fantasmas más agresivos, linterna mejorable y logros
   guardados en `localStorage`.
3. **Cooperativo ligero + ranking online** (WebSocket/WebRTC): quién resuelve el misterio con
   más cordura, integrable con la Mini App de Telegram.

---

Hecho con 🧠 por Key · pixel art generado 100% por código.
