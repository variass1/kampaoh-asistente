/* Asistente Kampaoh — se integra en cualquier web con una línea:
 *   Burbuja flotante:   <script src="https://TU-DOMINIO/widget.js" data-api="https://TU-DOMINIO" defer></script>
 *   Pantalla completa:  <script src="https://TU-DOMINIO/widget.js" data-api="https://TU-DOMINIO" data-mode="fullpage" defer></script>
 * Chat por texto + voz (dictado del navegador; respuesta con voz realista de ElevenLabs si el servidor la tiene configurada).
 */
(() => {
  const me = document.currentScript;
  const API = (me && me.dataset.api) || "";
  const FULL = me && me.dataset.mode === "fullpage";
  const sessionId = (() => {
    try {
      let id = sessionStorage.getItem("kmp-sid");
      if (!id) sessionStorage.setItem("kmp-sid", (id = crypto.randomUUID()));
      return id;
    } catch { return crypto.randomUUID(); }
  })();

  const css = `
  .kmp-root{--y:#FFD100;--k:#000;--k2:#141414;--soft:#F4F4F1;--line:#E6E6E1;--muted:#6B6B66;--text:#111;
    font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text);z-index:99999}
  .kmp-root *{box-sizing:border-box}
  .kmp-root button,.kmp-root input,.kmp-root a{touch-action:manipulation}
  .kmp-full{height:100dvh}
  .kmp-float{position:fixed;right:20px;bottom:20px}
  .kmp-fab{width:64px;height:64px;border-radius:50%;border:0;background:var(--y);color:var(--k);cursor:pointer;
    box-shadow:0 8px 24px rgba(0,0,0,.3);display:grid;place-items:center;transition:transform .15s}
  .kmp-fab:hover{transform:scale(1.06)}
  .kmp-panel{background:#fff;display:none;flex-direction:column;overflow:hidden}
  .kmp-float .kmp-panel{position:absolute;right:0;bottom:80px;width:390px;max-width:calc(100vw - 32px);height:640px;max-height:calc(100vh - 120px);
    border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .kmp-open .kmp-panel,.kmp-full .kmp-panel{display:flex}
  .kmp-full{position:fixed;inset:0;background:var(--k);display:flex;justify-content:center}
  .kmp-full .kmp-panel{width:100%;max-width:760px;height:100%}
  @media(min-width:800px){.kmp-full{padding:24px}.kmp-full .kmp-panel{border-radius:24px}}
  .kmp-head{background:var(--k);color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
  .kmp-logo-img{display:block;height:30px;width:auto;filter:invert(1);mix-blend-mode:screen;margin:-2px 0 2px -4px}
  .kmp-head small{display:block;color:#bdbdb7;font-size:12px;margin-top:2px}
  .kmp-head .kmp-x{margin-left:8px;background:none;border:0;color:#fff;font-size:24px;cursor:pointer;line-height:1}
  .kmp-voice-toggle{margin-left:auto;background:transparent;border:1px solid #444;color:#fff;border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer}
  .kmp-voice-toggle[aria-pressed=true]{background:var(--y);border-color:var(--y);color:var(--k);font-weight:600}
  .kmp-msgs{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:10px;background:var(--soft)}
  .kmp-msg{max-width:85%;padding:11px 14px;border-radius:18px;line-height:1.45;font-size:15px;white-space:pre-wrap}
  .kmp-bot{background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px;align-self:flex-start}
  .kmp-user{background:var(--k);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
  .kmp-typing{color:var(--muted);font-size:13px;align-self:flex-start}
  .kmp-card{background:#fff;border-radius:16px;padding:12px;align-self:stretch;border:1px solid var(--line);font-size:14px}
  .kmp-card h4{margin:0 0 8px;font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
  .kmp-opt{display:flex;align-items:center;padding:10px 0;border-top:1px solid #f0f0ec;gap:10px}
  .kmp-opt:first-of-type{border-top:0}
  .kmp-opt img{width:60px;height:60px;border-radius:12px;object-fit:cover;flex:none}
  .kmp-opt button{background:var(--y);color:var(--k);border:0;border-radius:999px;padding:8px 14px;cursor:pointer;font-weight:700;font-size:13px;flex:none}
  .kmp-opt button:hover{background:#000;color:var(--y)}
  .kmp-no{color:var(--muted);font-size:12.5px}
  .kmp-panel{position:relative}
  .kmp-pay{position:absolute;inset:0;background:#fff;display:none;flex-direction:column;z-index:5}
  .kmp-pay.on{display:flex}
  .kmp-pay-bar{display:flex;align-items:center;justify-content:space-between;background:var(--k);padding:10px 14px}
  .kmp-pay-back{background:var(--y);color:var(--k);border:0;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer}
  .kmp-pay-ext{color:#ddd;font-size:12.5px;text-decoration:none}
  .kmp-pay iframe{flex:1;width:100%;border:0}
  .kmp-opt-col{flex-direction:column;align-items:stretch}
  .kmp-rates{display:flex;gap:8px}
  .kmp-opt .kmp-rate{flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:1px;background:#fff;color:var(--k);border:1.5px solid var(--line);border-radius:12px;padding:8px 12px;font-weight:400;text-align:left}
  .kmp-opt .kmp-rate span{font-size:12px;color:var(--muted)}
  .kmp-opt .kmp-rate b{font-size:16px}
  .kmp-opt .kmp-rate:hover{border-color:var(--k);background:var(--y);color:var(--k)}
  .kmp-opt .kmp-rate:hover span{color:var(--k)}
  .kmp-one{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .kmp-price{font-size:17px}
  .kmp-tribe-sm{display:inline-block;font-size:12px;color:var(--muted);margin-top:2px}
  .kmp-tribe-sm::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--y);margin-right:5px;vertical-align:1px}
  .kmp-thumb,.kmp-opt .kmp-thumb,.kmp-opt .kmp-thumb:hover{position:relative;border:0;padding:0;background:none;cursor:zoom-in;flex:none;border-radius:12px;overflow:hidden}
  .kmp-thumb img{display:block;width:72px;height:72px;object-fit:cover;border-radius:12px}
  .kmp-opt .kmp-thumb img{width:72px;height:72px;object-fit:cover;border-radius:12px}
  .kmp-thumb span{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.7);color:#fff;font-size:10.5px;padding:1px 5px;border-radius:6px}
  .kmp-gal{position:absolute;inset:0;background:rgba(0,0,0,.94);display:none;flex-direction:column;z-index:6;color:#fff}
  .kmp-gal.on{display:flex}
  .kmp-gal-top{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;font-weight:600}
  .kmp-gal-top button{background:none;border:0;color:#fff;font-size:26px;cursor:pointer;line-height:1}
  .kmp-gal-main{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0}
  .kmp-gal-main img{max-width:100%;max-height:100%;object-fit:contain}
  .kmp-gal-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:var(--y);color:#000;font-size:20px;cursor:pointer}
  .kmp-gal-prev{left:10px}.kmp-gal-next{right:10px}
  .kmp-gal-dots{display:flex;gap:6px;overflow-x:auto;padding:10px 14px}
  .kmp-gal-dots img{width:56px;height:42px;object-fit:cover;border-radius:6px;opacity:.5;cursor:pointer;flex:none}
  .kmp-gal-dots img.on{opacity:1;outline:2px solid var(--y)}
  .kmp-switch{display:block;width:100%;margin-top:10px;background:#fff;border:1.5px solid var(--line);border-radius:999px;padding:9px;cursor:pointer;font-size:13px}
  .kmp-switch:hover{border-color:var(--k)}
  .kmp-ok{border:2px solid var(--k);line-height:1.55}
  .kmp-cta{display:block;margin-top:12px;text-align:center;background:var(--k);color:var(--y);text-decoration:none;border-radius:999px;padding:12px;font-weight:700}
  .kmp-chips{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px 0;background:#fff}
  .kmp-chips button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 12px;font-size:13px;cursor:pointer}
  .kmp-chips button:hover{border-color:var(--k)}
  .kmp-form{display:flex;gap:8px;padding:12px 14px;background:#fff;align-items:center}
  .kmp-form input{flex:1;min-width:0;border:1.5px solid var(--line);border-radius:999px;padding:12px 16px;font-size:16px;outline:none}
  .kmp-form input:focus{border-color:var(--k)}
  .kmp-btn{width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;flex:none}
  .kmp-send{background:var(--k);color:var(--y)}
  .kmp-mic{background:var(--y);color:var(--k)}
  .kmp-full .kmp-mic{width:54px;height:54px}
  .kmp-mic.on{background:var(--k);color:var(--y);animation:kmp-pulse 1.2s infinite}
  .kmp-mic.speaking{background:var(--k);color:var(--y)}
  @keyframes kmp-pulse{0%{box-shadow:0 0 0 0 rgba(255,209,0,.7)}100%{box-shadow:0 0 0 14px rgba(255,209,0,0)}}
  .kmp-foot{font-size:11px;color:var(--muted);text-align:center;padding:0 0 10px;background:#fff}
  `;
  const icon = {
    chat: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 20l1.5-4.5A8 8 0 1 1 8 19.5L3 20z"/></svg>',
    mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  };

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.className = "kmp-root " + (FULL ? "kmp-full" : "kmp-float");
  root.innerHTML = `
    <div class="kmp-panel" role="dialog" aria-label="Asistente Kampaoh">
      <div class="kmp-head">
        <div><img class="kmp-logo-img" src="${API}/logo.png" alt="Kampaoh"><small class="kmp-status">Asistente · Kampaoh Córdoba</small></div>
        <button class="kmp-voice-toggle" aria-pressed="true" title="Quitar o poner la voz">🔊 Voz</button>
        ${FULL ? "" : '<button class="kmp-x" aria-label="Cerrar">×</button>'}
      </div>
      <div class="kmp-msgs" aria-live="polite"></div>
      <div class="kmp-chips">
        <button>Quiero reservar</button><button>¿Cómo son las tiendas?</button><button>¿Tiene parking?</button><button>¿Qué hay en el camping?</button>
      </div>
      <form class="kmp-form">
        <input placeholder="Escribe o pulsa el micro…" aria-label="Mensaje" />
        <button class="kmp-btn kmp-send" aria-label="Enviar">${icon.send}</button>
        <button type="button" class="kmp-btn kmp-mic" aria-label="Hablar">${icon.mic}</button>
      </form>
      <div class="kmp-foot kmp-mode"></div>
    </div>
    ${FULL ? "" : `<button class="kmp-fab" aria-label="Abrir asistente">${icon.chat}</button>`}`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const msgs = $(".kmp-msgs"), input = $("input"), micBtn = $(".kmp-mic"), voiceBtn = $(".kmp-voice-toggle"), status = $(".kmp-status");
  const idleStatus = status.textContent;
  // Voz activada por defecto; el usuario puede quitarla con el botón "Voz" (se recuerda en este navegador)
  let speakReplies = (() => { try { return localStorage.getItem("kmp-voz") !== "off"; } catch { return true; } })();
  let busy = false, conversationMode = false, serverTTS = false;

  const add = (cls, html) => {
    const el = document.createElement("div");
    el.className = cls;
    el.innerHTML = html;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const eur = (n) => (Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")) + " €";

  // Nombres de tarifa que entiende cualquiera
  const etiqueta = (t) => (String(t).toUpperCase() === "FLEX" ? "Cancelación gratis" : String(t).toUpperCase() === "SMART" ? "No reembolsable" : t);
  // Galería: cada tienda registra sus fotos; la miniatura abre el visor dentro del chat
  const galerias = {};
  const foto = (o) => {
    if (!o.imagen) return "";
    const id = "g" + (o.id || o.roomTypeId);
    galerias[id] = { nombre: o.nombre, fotos: o.fotos?.length ? o.fotos : [o.imagen] };
    const n = galerias[id].fotos.length;
    return `<button class="kmp-thumb" data-gal="${id}" aria-label="Ver fotos de ${esc(o.nombre)}"><img src="${esc(o.imagen)}" alt="" loading="lazy">${n > 1 ? `<span>${n} fotos</span>` : ""}</button>`;
  };

  function renderEvent(ev) {
    const d = ev.data;
    if (ev.type === "consultar_disponibilidad" && d.opciones) {
      const libres = d.opciones.filter((o) => o.disponible);
      const rows = libres.map((o) => {
        const tags = [o.capacidad && `hasta ${o.capacidad} pers.`, o.bano_privado && "baño privado", o.aire_acondicionado && "aire acond.", o.mascotas && "admite perros"].filter(Boolean).join(" · ");
        const pick = (t) => `Me quedo con la ${o.nombre}, ${etiqueta(t.tarifa).toLowerCase()}`;
        const tarifas = o.tarifas.length
          ? o.tarifas.length === 1
            ? `<div class="kmp-one"><div><b class="kmp-price">${eur(o.tarifas[0].total)}</b><span class="kmp-no"> · ${etiqueta(o.tarifas[0].tarifa)}</span></div>
                <button data-send="${esc(pick(o.tarifas[0]))}">Elegir</button></div>`
            : `<div class="kmp-rates">${o.tarifas.map((t) =>
                `<button class="kmp-rate" data-send="${esc(pick(t))}"><span>${etiqueta(t.tarifa)}</span><b>${eur(t.total)}</b></button>`).join("")}</div>`
          : "";
        return `<div class="kmp-opt kmp-opt-col">
          <div style="display:flex;gap:12px;align-items:center">${foto(o)}
          <div style="flex:1;min-width:0"><b>${esc(o.nombre)}</b><br><span class="kmp-no">${tags}</span>
          ${o.desde_tribe ? `<br><span class="kmp-tribe-sm">−5 % con Kampaoh Tribe</span>` : ""}</div></div>
          ${tarifas}</div>`;
      }).join("");
      const full = d.opciones.length - libres.length;
      add("kmp-card", `<h4>${fmtDate(d.entrada)} → ${fmtDate(d.salida)} · ${d.noches} noches · ${d.adultos + (d.ninos || 0)} pers.${d.mascota ? " · con perro" : ""}</h4>
        ${rows || '<span class="kmp-no">Sin disponibilidad</span>'}${full ? `<div class="kmp-no" style="margin-top:6px">${full} tienda(s) completas en esas fechas</div>` : ""}`);
    }
    if (ev.type === "recomendacion" && d.tiendas) {
      const rows = d.tiendas.map((t) => {
        const tags = [t.capacidad && `hasta ${t.capacidad} pers.`, t.m2 && `${t.m2} m²`, t.bano_privado && "baño privado", t.aire_acondicionado && "A/C", t.mascotas && "🐶"].filter(Boolean).join(" · ");
        return `<div class="kmp-opt">${foto(t)}
          <div style="flex:1;min-width:0"><b>${esc(t.nombre)}</b><br><span class="kmp-no">${tags}</span><br><span class="kmp-no" style="color:#111">${esc(t.por.slice(0, 3).join(" · "))}</span></div></div>`;
      }).join("");
      add("kmp-card", `<h4>${esc(d.titulo)}</h4>${rows}`);
    }
    if (ev.type === "fechas_baratas" && d.mas_baratas) {
      const mesNom = d.titulo || new Date(Date.UTC(d.anio, d.mes - 1, 15)).toLocaleDateString("es-ES", { month: "long" });
      const rows = d.mas_baratas.map((f) => {
        const dia = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
        const txt = `Del ${new Date(f.entrada + "T12:00:00").getDate()} al ${new Date(f.salida + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`;
        return `<div class="kmp-opt"><div style="flex:1;min-width:0"><b>${dia(f.entrada)} → ${dia(f.salida)}</b><br>
          <span class="kmp-no">desde <b style="color:#111">${eur(f.total)}</b> · ${esc(f.tienda)} · ${f.opciones_libres} tiendas libres</span></div>
          <button data-send="${esc(txt)}">Elegir</button></div>`;
      }).join("");
      add("kmp-card", `<h4>Fechas más baratas · ${mesNom} · ${d.noches} noches · ${d.adultos + (d.ninos || 0)} pers.</h4>${rows || '<span class="kmp-no">Sin disponibilidad</span>'}`);
    }
    if (ev.type === "preparar_reserva" && d.enlace) {
      const otra = (d.otras_tarifas || [])[0];
      add("kmp-card kmp-ok", `<h4>Tu reserva, lista para confirmar</h4>
        <div style="display:flex;gap:12px;align-items:center">${foto({ ...d, id: d.alojamiento_id, nombre: d.alojamiento })}
        <div><b>${esc(d.alojamiento)}</b><br>${fmtDate(d.entrada)} → ${fmtDate(d.salida)} · ${d.noches} noches · ${d.adultos + (d.ninos || 0)} pers.</div></div>
        <div style="margin-top:8px">Total <b class="kmp-price">${eur(d.total)}</b> · ${etiqueta(d.tarifa)}<br><span class="kmp-no">${esc(d.cancelacion || "")}</span></div>
        ${d.total_tribe ? `<div class="kmp-tribe-sm" style="margin-top:4px">Con Kampaoh Tribe: ${eur(d.total_tribe)} o menos, iniciando sesión al pagar</div>` : ""}
        ${otra ? `<button class="kmp-switch" data-send="${esc(`Me quedo con la ${d.alojamiento}, ${etiqueta(otra.tarifa).toLowerCase()}`)}">Prefiero ${etiqueta(otra.tarifa).toLowerCase()}: ${eur(otra.total)}</button>` : ""}
        <a class="kmp-cta" href="${esc(d.enlace)}" data-checkout="${esc(d.enlace)}" target="_blank" rel="noopener">Reservar y pagar aquí →</a>`);
    }
  }

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
  
  // ---------- Voz: salida ----------
  // 1) Voz realista del servidor (ElevenLabs).  2) Si no hay, la mejor voz en español del navegador.
  const synth = window.speechSynthesis;
  const audio = new Audio();
  audio.setAttribute("playsinline", "");
  audio.preload = "auto";
  let audioUrl = null;
  function bestBrowserVoice() {
    const vs = (synth ? synth.getVoices() : []).filter((v) => /^es/i.test(v.lang));
    const score = (v) =>
      (/es-ES/i.test(v.lang) ? 10 : 0) + (/(premium|enhanced|mejorada|natural|neural)/i.test(v.name) ? 20 : 0) +
      (/google/i.test(v.name) ? 8 : 0) + (/(mónica|monica|lucía|lucia|paulina|marisol|elvira|dalia)/i.test(v.name) ? 5 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0];
  }
  function stopSpeaking() {
    synth && synth.cancel();
    audio.pause();
    micBtn.classList.remove("speaking");
  }
  // Los móviles (sobre todo iPhone) solo dejan sonar audio iniciado por un toque del usuario.
  // En el primer toque "desbloqueamos" el reproductor y la voz del navegador para poder hablar después.
  let audioDesbloqueado = false;
  const SILENCIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
  function desbloquearAudio() {
    if (audioDesbloqueado) return;
    audioDesbloqueado = true;
    try {
      audio.src = SILENCIO;
      const p = audio.play();
      if (p && p.then) p.then(() => audio.pause()).catch(() => { audioDesbloqueado = false; });
    } catch { audioDesbloqueado = false; }
    try {
      if (synth) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); }
    } catch {}
  }
  ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => root.addEventListener(ev, desbloquearAudio, { passive: true }));

  const hablarNavegador = (text) =>
    new Promise((res) => {
      if (!synth) return res();
      synth.cancel();
      const u = new SpeechSynthesisUtterance(paraVoz(text));
      u.lang = "es-ES";
      const v = bestBrowserVoice();
      if (v) u.voice = v;
      u.rate = 1.03;
      u.onend = u.onerror = res;
      synth.speak(u);
      // Chrome en Android a veces se queda "pausado": lo despertamos
      setTimeout(() => { try { synth.resume(); } catch {} }, 250);
    });

  async function speak(text) {
    if (!speakReplies || !text) return;
    stopSpeaking();
    micBtn.classList.add("speaking");
    status.textContent = "Kampi está hablando…";
    try {
      let hecho = false;
      if (serverTTS) {
        try {
          const r = await fetch(API + "/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
          if (!r.ok) throw new Error("tts " + r.status);
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          audioUrl = URL.createObjectURL(await r.blob());
          audio.src = audioUrl;
          await audio.play();
          hecho = true;
          await new Promise((res) => { audio.onended = audio.onerror = audio.onpause = res; });
        } catch (e) {
          if (hecho) throw e;
          console.warn("Voz natural no disponible, uso la del navegador:", e.message);
        }
      }
      if (!hecho) await hablarNavegador(text); // si falla la voz natural (sin saldo, límite, bloqueo), habla el navegador
    } catch {}
    micBtn.classList.remove("speaking");
    status.textContent = idleStatus;
  }

  // ---------- Voz: entrada (dictado) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  if (SR) {
    rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const r = [...e.results].map((x) => x[0].transcript).join("");
      input.value = r;
      if (e.results[e.results.length - 1].isFinal) { stopListening(); send(r); }
    };
    rec.onerror = (e) => {
      stopListening();
      conversationMode = false;
      if (e.error === "not-allowed") add("kmp-typing", "Para hablar, permite el uso del micrófono en el navegador.");
    };
    rec.onend = () => listening && stopListening();
  } else {
    micBtn.title = "Tu navegador no permite dictado por voz (prueba Chrome, Edge o Safari)";
    micBtn.style.opacity = 0.4;
  }
  function startListening() {
    if (!rec || listening) return;
    stopSpeaking();
    listening = true;
    micBtn.classList.add("on");
    status.textContent = "Te escucho…";
    try { rec.start(); } catch {}
  }
  function stopListening() {
    listening = false;
    micBtn.classList.remove("on");
    status.textContent = idleStatus;
    try { rec.stop(); } catch {}
  }
  micBtn.onclick = () => {
    if (!rec) return;
    if (listening || micBtn.classList.contains("speaking")) { conversationMode = false; stopSpeaking(); return stopListening(); }
    // Pulsar el micro activa "modo conversación": escucha → responde en voz alta → vuelve a escuchar
    conversationMode = true;
    if (!speakReplies) toggleVoice(true);
    startListening();
  };
  function toggleVoice(on) {
    speakReplies = on ?? !speakReplies;
    try { localStorage.setItem("kmp-voz", speakReplies ? "on" : "off"); } catch {}
    voiceBtn.setAttribute("aria-pressed", speakReplies);
    voiceBtn.textContent = speakReplies ? "🔊 Voz" : "🔈 Voz";
    if (!speakReplies) { stopSpeaking(); conversationMode = false; }
  }
  voiceBtn.onclick = () => toggleVoice();
  toggleVoice(speakReplies);

  // ---------- Chat ----------
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    add("kmp-msg kmp-user", esc(text));
    $(".kmp-chips").style.display = "none"; // tras el primer mensaje, las sugerencias sobran
    const typing = add("kmp-typing", "Kampi está escribiendo…");
    try {
      const r = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: text, destino: (me && me.dataset.destino) || "cordoba" }),
      }).then((x) => x.json());
      typing.remove();
      (r.events || []).forEach(renderEvent);
      add("kmp-msg kmp-bot", esc(r.text || "Perdona, no te he entendido."));
      busy = false;
      await speak(r.text || "");
      if (conversationMode && !(r.events || []).some((e) => e.type === "preparar_reserva")) startListening();
    } catch {
      typing.remove();
      add("kmp-msg kmp-bot", "Uy, se ha cortado la conexión. ¿Lo intentas de nuevo?");
      busy = false;
    }
  }

  $(".kmp-form").onsubmit = (e) => { e.preventDefault(); conversationMode = false; send(input.value); };
  $(".kmp-chips").onclick = (e) => e.target.tagName === "BUTTON" && send(e.target.textContent);
  // ---------- Checkout oficial de Kampaoh dentro del asistente ----------
  const pay = document.createElement("div");
  pay.className = "kmp-pay";
  pay.innerHTML = `<div class="kmp-pay-bar"><button class="kmp-pay-back">← Volver al chat</button>
    <a class="kmp-pay-ext" target="_blank" rel="noopener">Abrir en pestaña nueva ↗</a></div><iframe title="Pago Kampaoh" allow="payment *"></iframe>`;
  $(".kmp-panel").appendChild(pay);
  const openCheckout = (url) => {
    stopListening(); stopSpeaking(); conversationMode = false;
    pay.querySelector("iframe").src = url;
    pay.querySelector(".kmp-pay-ext").href = url;
    pay.classList.add("on");
  };
  pay.querySelector(".kmp-pay-back").onclick = () => pay.classList.remove("on");

  // ---------- Galería de fotos dentro del chat ----------
  const gal = document.createElement("div");
  gal.className = "kmp-gal";
  gal.innerHTML = `<div class="kmp-gal-top"><span class="kmp-gal-name"></span><button aria-label="Cerrar">×</button></div>
    <div class="kmp-gal-main"><img alt=""><button class="kmp-gal-nav kmp-gal-prev" aria-label="Anterior">‹</button><button class="kmp-gal-nav kmp-gal-next" aria-label="Siguiente">›</button></div>
    <div class="kmp-gal-dots"></div>`;
  $(".kmp-panel").appendChild(gal);
  let galFotos = [], galI = 0;
  const galShow = (i) => {
    galI = (i + galFotos.length) % galFotos.length;
    gal.querySelector(".kmp-gal-main img").src = galFotos[galI];
    gal.querySelectorAll(".kmp-gal-dots img").forEach((im, k) => im.classList.toggle("on", k === galI));
    const multi = galFotos.length > 1;
    gal.querySelectorAll(".kmp-gal-nav").forEach((b) => (b.style.display = multi ? "" : "none"));
  };
  const openGal = (id) => {
    const g = galerias[id];
    if (!g) return;
    galFotos = g.fotos;
    gal.querySelector(".kmp-gal-name").textContent = g.nombre;
    gal.querySelector(".kmp-gal-dots").innerHTML = galFotos.map((f, k) => `<img src="${esc(f)}" data-k="${k}" alt="">`).join("");
    gal.classList.add("on");
    galShow(0);
  };
  gal.querySelector(".kmp-gal-top button").onclick = () => gal.classList.remove("on");
  gal.querySelector(".kmp-gal-prev").onclick = () => galShow(galI - 1);
  gal.querySelector(".kmp-gal-next").onclick = () => galShow(galI + 1);
  gal.querySelector(".kmp-gal-dots").onclick = (e) => e.target.dataset.k && galShow(+e.target.dataset.k);
  document.addEventListener("keydown", (e) => {
    if (!gal.classList.contains("on")) return;
    if (e.key === "Escape") gal.classList.remove("on");
    if (e.key === "ArrowLeft") galShow(galI - 1);
    if (e.key === "ArrowRight") galShow(galI + 1);
  });
  // deslizar con el dedo en móvil
  let x0 = null;
  gal.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  gal.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) galShow(galI + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  msgs.onclick = (e) => {
    const th = e.target.closest("[data-gal]");
    if (th) return openGal(th.dataset.gal);
    const co = e.target.closest("[data-checkout]");
    if (co) { e.preventDefault(); return openCheckout(co.dataset.checkout); }
    if (e.target.dataset.pick) send(`Me quedo con la ${e.target.dataset.pick}`);
    else { const b = e.target.closest("[data-send]"); if (b) send(b.dataset.send); }
  };
  const greet = () =>
    !msgs.children.length &&
    add("kmp-msg kmp-bot", "¡Hola! Soy Kampi, de Kampaoh Córdoba. ¿En qué te puedo ayudar? Puedes escribirme o pulsar el micro.");
  const toggle = (open) => {
    if (FULL) return;
    root.classList.toggle("kmp-open", open);
    if (open) { greet(); input.focus(); } else { stopListening(); stopSpeaking(); }
  };
  if (FULL) greet();
  else {
    $(".kmp-fab").onclick = () => toggle(!root.classList.contains("kmp-open"));
    $(".kmp-x").onclick = () => toggle(false);
  }

  fetch(API + "/api/info").then((r) => r.json()).then((i) => {
    serverTTS = i.tts === "elevenlabs";
    $(".kmp-mode").textContent =
      (i.mode === "ia" ? `Asistente con IA` : "Modo demo") + " · disponibilidad y precios reales" + (serverTTS ? " · voz natural" : "");
  }).catch(() => {});
  window.KampaohAsistente = { open: () => toggle(true), close: () => toggle(false) };
})();
