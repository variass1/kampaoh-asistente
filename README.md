# Kampi · Asistente de Kampaoh (demo Córdoba)

Asistente para la web de Kampaoh que responde dudas, recomienda tiendas y lleva la reserva hasta el pago, por texto o por voz.

## Qué hace

- **Conversación natural con IA** (Claude): entiende cualquier forma de preguntar, recuerda lo hablado y pregunta una cosa cada vez.
- **Disponibilidad y precios reales** de Kampaoh Córdoba, con las dos tarifas: cancelación gratis y no reembolsable.
- **Fechas más baratas** de un mes o de una semana ("en diciembre, lo más barato").
- **Recomendaciones** según niños, perro, pareja, baño privado, aire acondicionado, bañera o presupuesto.
- **Fotos** de cada tienda en una galería dentro del chat.
- **Pago dentro del chat**: abre el checkout oficial de Kampaoh con todo seleccionado, incluido el inicio de sesión de Kampaoh Tribe (desde −5 %).
- **Voz**: dictado del navegador y respuestas con voz natural (ElevenLabs); se puede quitar.
- **Modo demo**: sin clave de IA funciona con reglas sencillas y datos reales.

## Probarlo en local

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
cp .env.example .env      # y rellena las claves (opcional)
node --env-file-if-exists=.env server.mjs
```

Abre http://localhost:3000. La voz funciona mejor en Chrome.

## Integrarlo en la web

Una sola línea en cualquier página:

```html
<!-- Burbuja flotante -->
<script src="https://TU-SERVIDOR/widget.js" data-api="https://TU-SERVIDOR" data-destino="cordoba" defer></script>
<!-- Pantalla completa -->
<script src="https://TU-SERVIDOR/widget.js" data-api="https://TU-SERVIDOR" data-mode="fullpage" defer></script>
```

## Estructura

| Archivo | Para qué |
|---|---|
| `server.mjs` | Servidor sin dependencias: chat con Claude y herramientas, modo demo, voz (ElevenLabs) |
| `destino.mjs` | Conexión con las APIs que usa booking.kampaoh.com: CMS (tiendas, fotos) y motor de reservas (disponibilidad, tarifas, enlace al checkout) |
| `recomendador.mjs` | Puntúa las tiendas según lo que busca el cliente |
| `demo-mode.mjs` | Conversación guiada sin IA |
| `conocimiento/cordoba.md` | Información del destino validada por el equipo (prioridad sobre el CMS) |
| `public/widget.js` | El asistente: chat, tarjetas, galería, voz y checkout |

## Coste aproximado

Con Claude Sonnet 5.5 y caché: unos 1,5 céntimos por mensaje (≈0,09 $ una conversación completa con reserva).

## Antes de producción

- Confirmar con el equipo técnico de Kampaoh el uso de sus APIs (no están documentadas).
- Clave de Anthropic de empresa y sin caducidad; guardar las sesiones en una base de datos.
- Revisar privacidad con protección de datos (Anthropic y ElevenLabs).
