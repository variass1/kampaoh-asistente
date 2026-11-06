// Asistente Kampaoh — servidor (Node 18+, sin dependencias)
// Modo IA:   ANTHROPIC_API_KEY=sk-... node server.mjs   → conversación libre con Claude + APIs reales de Kampaoh
// Modo demo: node server.mjs                             → flujo guiado sin IA (también usa disponibilidad real)

import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDestino, consultarDisponibilidad, prepararReserva, buscarFechasBaratas } from "./destino.mjs";
import { demoReply } from "./demo-mode.mjs";

const PORT = Number(process.env.PORT || 3000);
for (const k of ["ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"]) if (!process.env[k]) delete process.env[k]; // vacías en .env = no configuradas
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(ROOT, "public");
const conocimiento = () => readFile(join(ROOT, "conocimiento", "cordoba.md"), "utf8").catch(() => "");

// ---------- Herramientas que Claude puede usar ----------
const TOOLS = [
  {
    name: "consultar_disponibilidad",
    description:
      "Consulta en tiempo real (motor de reservas de Kampaoh) qué tiendas de Kampaoh Córdoba están libres y su precio total para unas fechas y huéspedes. Úsala SIEMPRE antes de dar precios o disponibilidad.",
    input_schema: {
      type: "object",
      properties: {
        entrada: { type: "string", description: "Fecha de entrada YYYY-MM-DD" },
        salida: { type: "string", description: "Fecha de salida YYYY-MM-DD" },
        adultos: { type: "integer", minimum: 1 },
        ninos: { type: "integer", minimum: 0 },
        bebes: { type: "integer", minimum: 0 },
        mascota: { type: "boolean", description: "true si viene perro: solo se muestran tiendas que admiten mascotas" },
      },
      required: ["entrada", "salida", "adultos"],
    },
  },
  {
    name: "buscar_fechas_baratas",
    description:
      "Busca las fechas más baratas de un mes concreto (consulta todas las posibles fechas de entrada en el motor de reservas). Úsala cuando el cliente tenga flexibilidad: 'en noviembre', 'lo más barato', 'me da igual el día', 'algún finde de mayo'.",
    input_schema: {
      type: "object",
      properties: {
        mes: { type: "integer", minimum: 1, maximum: 12 },
        anio: { type: "integer" },
        noches: { type: "integer", minimum: 1, maximum: 7, description: "Por defecto 2" },
        adultos: { type: "integer", minimum: 1 },
        ninos: { type: "integer", minimum: 0 },
        mascota: { type: "boolean" },
        solo_fines_de_semana: { type: "boolean", description: "true = solo entradas en viernes" },
      },
      required: ["mes", "adultos"],
    },
  },
  {
    name: "preparar_reserva",
    description:
      "Prepara la reserva de la tienda y tarifa elegidas y devuelve el enlace a la web oficial de reservas con fechas y huéspedes ya rellenos, donde el cliente pone sus datos y paga. Llamar cuando el cliente haya elegido tienda (y tarifa FLEX o SMART).",
    input_schema: {
      type: "object",
      properties: {
        alojamiento_id: { type: "integer", description: "id de la opción devuelta por consultar_disponibilidad" },
        tarifa: { type: "string", enum: ["FLEX", "SMART"] },
        entrada: { type: "string" },
        salida: { type: "string" },
        adultos: { type: "integer" },
        ninos: { type: "integer" },
        bebes: { type: "integer" },
        mascota: { type: "boolean" },
      },
      required: ["alojamiento_id", "entrada", "salida", "adultos"],
    },
  },
];

async function systemPrompt() {
  const hoy = new Date().toISOString().slice(0, 10);
  const dest = await getDestino();
  const tiendas = dest.tiendas.map(({ imagen, ...t }) => t);
  return `Eres "Kampi", el asistente de Kampaoh en la web. Hoy es ${hoy}. Atiendes el destino ${dest.nombre} (${dest.camping}).

<informacion_interna>
Información validada por el equipo de Kampaoh. Tiene PRIORIDAD sobre cualquier otra fuente.
${await conocimiento()}
</informacion_interna>

<datos_web>
Datos del destino y de las tiendas publicados en la web (CMS). Úsalos para describir las tiendas y cuando la información interna no diga nada; si se contradicen, manda la información interna.
${JSON.stringify({ ...dest, tiendas }, null, 1)}
</datos_web>

Cómo actuar:
- Nunca escribas URLs ni enlaces en tus respuestas: el chat ya muestra tarjetas con fotos, precios y el botón de pago.
- Parking: di solo lo de la información interna (está fuera del recinto y solo se entra con el coche a descargar); no afirmes que la reserva incluye plaza.
- MUY BREVE: máximo 2 frases cortas y unas 35 palabras por mensaje, como un buen recepcionista por WhatsApp. Las tarjetas ya enseñan precios, fechas, tiendas y fotos: no repitas en el texto lo que ya se ve en la tarjeta (nada de enumerar fechas, tarifas o tiendas que aparecen en ella); di solo lo esencial y la siguiente pregunta.
- Si el cliente solo saluda ("hola", "buenas"), en cualquier momento de la conversación, responde ÚNICAMENTE con un saludo breve y "¿En qué te puedo ayudar?". No preguntes por fechas, personas ni reservas, ni retomes lo anterior por tu cuenta. Tampoco digas "hola de nuevo".
- No des por hecho lo que quiere el cliente: no empujes a reservar. Responde a lo que pregunta; ofrece reservar solo cuando venga a cuento.
- Responde en el idioma del cliente, con tono cercano y alegre. Muchas respuestas se leerán en voz alta: nada de tablas, listas largas ni markdown.
- No inventes nada. Si algo no está en la información, dilo y ofrece el contacto de atención al cliente. Lo que aparece en "NO podemos garantizar" dilo aclarando que depende del camping.
- Para buscar necesitas fechas, personas y si viene perro, pero pregunta UNA sola cosa por mensaje, en este orden y solo lo que falte:
  1) Primero las fechas, con una pregunta corta y abierta: "¿Qué días te gustaría venir? Si eres flexible, te busco los más baratos." Nada más en ese mensaje.
  2) Después, cuántos sois (adultos y niños, en una sola pregunta sencilla).
  3) Por último, si viene perro, solo si no lo ha dicho ya; puedes unirlo a la pregunta anterior con naturalidad ("¿y os acompaña algún perro?").
  Si el cliente da varios datos de golpe, no vuelvas a preguntarlos. Nunca hagas una lista de preguntas.
  Si responde cuántos son pero no menciona perro, asume que no viene, busca ya y dilo en media frase ("lo miro sin perro; si viene, dímelo"). No repitas una pregunta que ya hiciste.
- Termina cada mensaje con como mucho UNA pregunta.
- Convierte fechas relativas ("el puente de diciembre", "este finde") a fechas concretas y confírmalas. Si coinciden con algún evento de Córdoba, menciónalo.
- Actúa como el mejor asesor de Kampaoh: detecta y recuerda lo que importa al cliente (niños y edades, perro, baño privado, pareja o aniversario, presupuesto, calor/aire acondicionado, bañera y relax, grupo de amigos, accesibilidad) y recomienda con los datos reales de cada tienda (capacidad, m², camas, baño, mascotas, A/C, equipamiento, descripción). Da siempre el porqué en una frase y una alternativa. Si una necesidad no se puede cubrir (p. ej. 6 personas con perro y baño privado), dilo y propone la mejor combinación (p. ej. dos tiendas).
- Avisos (piscina cerrada, restaurante, transporte, eventos…): solo si el cliente pregunta por ello o si afecta directamente a lo que ha pedido, y como mucho uno, en pocas palabras. No los añadas por costumbre.
- Acampada (parcela, caravana, tienda propia): la gestiona el Camping Los Villares, no Kampaoh; dilo y ofrece las tiendas de Kampaoh.
- Si el cliente es flexible ("en noviembre", "lo más barato", "algún finde"), usa buscar_fechas_baratas en vez de pedirle días concretos; si no sabes cuántos son, asume 2 adultos y dilo.
- Usa consultar_disponibilidad antes de dar precios: las cifras son reales, en euros. Recomienda la tienda que mejor encaje (capacidad, baño privado, mascotas, presupuesto) y di por qué en una frase. 
- Cuando elija, llama a preparar_reserva: devuelve el precio y la tarifa que de verdad vende la web y un enlace directo a la página de pago con todo seleccionado. Si devuelve tarifa_pedida_no_disponible, avísale de que solo queda la otra tarifa. Dile que pulse «Reservar y pagar aquí»: el pago oficial de Kampaoh se abre dentro del chat con todo seleccionado; ahí puede iniciar sesión con Kampaoh Tribe (desde un 5 % de descuento). Ofrece siempre las dos tarifas cuando existan, sin usar los nombres internos FLEX/SMART con el cliente: "con cancelación gratis" (hasta 48 h antes) y "no reembolsable" (más barata). Si solo hay una, di cuál es.`;
}

let costeTotal = 0;
async function callClaude(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    // cache_control: la info del destino (larga y casi fija) se reutiliza entre mensajes → mucho más barato y rápido
    // effort "low": para chat da respuestas igual de buenas, más rápidas y baratas
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, output_config: { effort: process.env.CLAUDE_EFFORT || "low" }, system: [{ type: "text", text: await systemPrompt(), cache_control: { type: "ephemeral" } }], tools: TOOLS, messages }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const j = await res.json();
  // Coste aproximado (Sonnet 5.5: 2 $/M entrada, 10 $/M salida, 0,20 $/M caché leída, 2,50 $/M caché escrita)
  const u = j.usage || {};
  const usd = ((u.input_tokens || 0) * 2 + (u.output_tokens || 0) * 10 + (u.cache_read_input_tokens || 0) * 0.2 + (u.cache_creation_input_tokens || 0) * 2.5) / 1e6;
  costeTotal += usd;
  contadores().gasto += usd;
  console.log(`[uso] in=${u.input_tokens} cache_leida=${u.cache_read_input_tokens || 0} cache_escrita=${u.cache_creation_input_tokens || 0} out=${u.output_tokens} → ${usd.toFixed(4)} $ (acumulado ${costeTotal.toFixed(3)} $)`);
  return j;
}

// Bucle de herramientas: devuelve texto final + eventos (disponibilidad/reserva) para pintar tarjetas en el widget
async function aiReply(history) {
  const messages = [...history];
  const events = [];
  for (let i = 0; i < 6; i++) {
    const resp = await callClaude(messages);
    messages.push({ role: "assistant", content: resp.content });
    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { text, events, messages };
    }
    const results = await Promise.all(
      toolUses.map(async (tu) => {
        let out;
        try {
          const fn = { consultar_disponibilidad: consultarDisponibilidad, buscar_fechas_baratas: buscarFechasBaratas, preparar_reserva: prepararReserva }[tu.name];
          out = await fn(tu.input);
          events.push({ type: tu.name === "buscar_fechas_baratas" ? "fechas_baratas" : tu.name, data: out });
        } catch (e) {
          out = { error: e.message };
        }
        // A la IA no le hacen falta las URLs de fotos (las pinta el widget): menos texto = menos coste
        return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out, (k, v) => (k === "fotos" || k === "imagen" ? undefined : v)) };
      })
    );
    messages.push({ role: "user", content: results });
  }
  return { text: "Perdona, me he liado un poco. ¿Me lo repites?", events, messages };
}

// Sesiones: en memoria + copia en disco para que un reinicio no corte las conversaciones (en producción: Redis / BD)
const SESIONES = join(ROOT, "data", "sesiones.json");
const sessions = new Map();
try {
  for (const [k, v] of Object.entries(JSON.parse(await readFile(SESIONES, "utf8")))) sessions.set(k, v);
} catch {}
let guardando = null;
const guardarSesiones = () => {
  clearTimeout(guardando);
  guardando = setTimeout(async () => {
    try {
      await mkdir(join(ROOT, "data"), { recursive: true });
      const recientes = [...sessions.entries()].filter(([, v]) => Date.now() - (v.at || 0) < 3 * 86400000); // 3 días
      await writeFile(SESIONES, JSON.stringify(Object.fromEntries(recientes)));
    } catch (e) {
      console.error("No pude guardar sesiones:", e.message);
    }
  }, 300);
};
let iaEstado = API_KEY ? "pendiente" : "sin_clave";

async function handleChat({ sessionId, message }, ip) {
  sessionId = String(sessionId || "").slice(0, 64) || "anon";
  message = String(message || "").slice(0, LIM.largoMensaje);
  const s = sessions.get(sessionId) || { history: [], demo: {} };
  sessions.set(sessionId, s);
  s.at = Date.now();
  try {
    return await responderChat(s, message, ip);
  } finally {
    guardarSesiones();
  }
}

// ---------- Límites para un enlace público (protegen el saldo de IA y voz) ----------
const LIM = {
  mensajesPorConversacion: Number(process.env.LIMITE_MENSAJES_CONVERSACION || 40),
  mensajesIaPorIpDia: Number(process.env.LIMITE_MENSAJES_IP_DIA || 60),
  gastoMaxDiaUsd: Number(process.env.LIMITE_GASTO_DIA_USD || 2),
  vocesPorIpDia: Number(process.env.LIMITE_VOZ_IP_DIA || 80),
  largoMensaje: 600,
};
const hoyStr = () => new Date().toISOString().slice(0, 10);
let dia = { fecha: hoyStr(), gasto: 0, ia: new Map(), voz: new Map() };
const contadores = () => { if (dia.fecha !== hoyStr()) dia = { fecha: hoyStr(), gasto: 0, ia: new Map(), voz: new Map() }; return dia; };
const sumar = (mapa, ip) => { const n = (mapa.get(ip) || 0) + 1; mapa.set(ip, n); return n; };

async function responderChat(s, message, ip = "?") {
  s.n = (s.n || 0) + 1;
  if (s.n > LIM.mensajesPorConversacion)
    return { text: "Hemos hablado mucho en esta conversación 😊. Para seguir, recarga la página o reserva directamente en booking.kampaoh.com.", events: [], mode: "limite" };
  const c = contadores();
  const iaPermitida = API_KEY && c.gasto < LIM.gastoMaxDiaUsd && sumar(c.ia, ip) <= LIM.mensajesIaPorIpDia;
  if (API_KEY && !iaPermitida) console.log(`[límite] IA desactivada para ${ip} (gasto hoy ${c.gasto.toFixed(2)} $)`);
  if (iaPermitida) {
    try {
      const { text, events, messages } = await aiReply([...s.history, { role: "user", content: message }]);
      s.history = messages;
      iaEstado = "ok";
      return { text, events, mode: "ia" };
    } catch (e) {
      // Sin saldo, clave caducada o caída de la API → seguimos en modo demo sin que el cliente lo note
      iaEstado = /credit balance/i.test(e.message) ? "sin_saldo" : "error";
      console.error("IA no disponible, uso modo demo:", e.message.slice(0, 200));
    }
  }
  return { ...(await demoReply(s.demo, message)), mode: "demo" };
}

// ---------- Voz realista (ElevenLabs) ----------
// ELEVENLABS_API_KEY=...  ELEVENLABS_VOICE_ID=... (voz en español de España elegida en la Voice Library de ElevenLabs)
// Sin clave, el widget usa la voz del navegador.
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
// Por defecto "Sarah" (voz multilingüe incluida en el plan gratuito). Con plan de pago se puede usar una voz
// de España de la Voice Library, p. ej. Raquel 1eHrpOW5l98cxiSRjbzJ o Carolina UOIqAnmS11Reiei1Ytkc.
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5"; // rápida (≈0,5 s); "eleven_multilingual_v2" = algo más natural pero tarda más
const ELEVEN_SPEED = Number(process.env.ELEVENLABS_SPEED || 1.12); // 0.7–1.2

// Texto para leer en voz alta: símbolos y abreviaturas en palabras ("73,95 €" → "73 euros con 95")
function paraVoz(t) {
  return String(t || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>]/g, "")
    .replace(/(\d+)[.,](\d{2})\s*€/g, (_, e, c) => `${e} euros${c === "00" ? "" : ` con ${+c}`}`)
    .replace(/(\d+)\s*€/g, "$1 euros")
    .replace(/€\s*(\d+)/g, "$1 euros")
    .replace(/€/g, "euros")
    .replace(/(\d+(?:[.,]\d+)?)\s*(m²|m2)\b/g, "$1 metros cuadrados")
    .replace(/m²/g, "metros cuadrados")
    .replace(/(\d+(?:[.,]\d+)?)\s*km\b/gi, "$1 kilómetros")
    .replace(/(\d+)\s*h\b/g, "$1 horas")
    .replace(/[-−]\s?(\d+(?:[.,]\d+)?)\s*%/g, "un $1 por ciento menos")
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, "$1 por ciento")
    .replace(/\bA\/C\b/g, "aire acondicionado")
    .replace(/\bpers\./g, "personas")
    .replace(/(\d{1,2}):00\b/g, "$1")
    .replace(/(\d+)\s*[–-]\s*(\d+)/g, "$1 al $2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function tts(text) {
  if (!ELEVEN_KEY) throw new Error("TTS no configurado");
  const clean = paraVoz(text).slice(0, 1200);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: clean,
      model_id: ELEVEN_MODEL,
      language_code: "es",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: ELEVEN_SPEED },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

// IP real del visitante (Render y otros servicios la pasan en x-forwarded-for)
const ipDe = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

http
  .createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/api/chat") {
        let raw = "";
        for await (const c of req) raw += c;
        if (raw.length > 5000) throw new Error("petición demasiado grande");
        const out = await handleChat(JSON.parse(raw), ipDe(req));
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify(out));
      }
      if (req.url === "/api/info") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ mode: API_KEY && iaEstado !== "sin_saldo" && iaEstado !== "error" ? "ia" : "demo", ia: iaEstado, model: API_KEY ? MODEL : null, tts: ELEVEN_KEY ? "elevenlabs" : "browser" }));
      }
      if (req.method === "POST" && req.url === "/api/tts") {
        let raw = "";
        for await (const c of req) raw += c;
        if (sumar(contadores().voz, ipDe(req)) > LIM.vocesPorIpDia) { res.writeHead(429); return res.end(); }
        const audio = await tts(JSON.parse(raw).text);
        res.writeHead(200, { "content-type": "audio/mpeg", "cache-control": "no-store" });
        return res.end(audio);
      }
      let path = req.url.split("?")[0];
      if (path === "/favicon.ico") { res.writeHead(204); return res.end(); }
      if (path === "/") path = "/index.html";
      if (path.includes("..")) throw new Error("bad path");
      const file = await readFile(join(PUBLIC, path));
      res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" });
      res.end(file);
    } catch (e) {
      console.error(e.message);
      res.writeHead(e.code === "ENOENT" ? 404 : 500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.code === "ENOENT" ? "not found" : "error interno" }));
    }
  })
  .listen(PORT, () => console.log(`Asistente Kampaoh en http://localhost:${PORT}  (modo ${API_KEY ? "IA · " + MODEL : "demo sin IA"})`));
