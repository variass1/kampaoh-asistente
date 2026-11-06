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
  .kmp-root{--y:#FFD100;--k:#000;--soft:#F5F4F0;--line:#E7E5DF;--muted:#6B6964;--text:#111;--r:18px;
    font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text);z-index:99999;-webkit-font-smoothing:antialiased}
  .kmp-root *{box-sizing:border-box}
  .kmp-root button,.kmp-root input,.kmp-root a{touch-action:manipulation;font-family:inherit}
  .kmp-root button{cursor:pointer}

  /* --- contenedores --- */
  .kmp-float{position:fixed;right:20px;bottom:20px}
  .kmp-fab{width:64px;height:64px;border-radius:50%;border:0;background:var(--y);color:var(--k);box-shadow:0 10px 28px rgba(0,0,0,.3);display:grid;place-items:center;transition:transform .2s}
  .kmp-fab:hover{transform:scale(1.07)}
  .kmp-panel{background:#fff;display:none;flex-direction:column;overflow:hidden;position:relative}
  .kmp-float .kmp-panel{position:absolute;right:0;bottom:80px;width:400px;max-width:calc(100vw - 32px);height:680px;max-height:calc(100vh - 120px);border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
  .kmp-open .kmp-panel,.kmp-full .kmp-panel{display:flex}
  .kmp-full{position:fixed;inset:0;height:var(--kmp-vh,100dvh);background:var(--k);display:flex;justify-content:center;overflow:hidden}
  .kmp-full::before{content:"";position:absolute;inset:-40px;background:var(--kmp-bg) center/cover no-repeat;filter:blur(28px) brightness(.45) saturate(1.1);transform:scale(1.05);opacity:0;transition:opacity .8s}
  .kmp-full.kmp-hasbg::before{opacity:1}
  .kmp-full .kmp-panel{width:100%;max-width:780px;height:100%;z-index:1}
  @media(min-width:820px){.kmp-full{padding:28px}.kmp-full .kmp-panel{border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.45)}}

  /* --- cabecera --- */
  .kmp-head{background:var(--k);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;padding-top:max(12px,env(safe-area-inset-top))}
  .kmp-ava{width:40px;height:40px;border-radius:50%;background:var(--y);display:grid;place-items:center;flex:none}
  .kmp-ava svg{width:22px;height:22px}
  .kmp-ava-sm{width:28px;height:28px}
  .kmp-ava-sm svg{width:15px;height:15px}
  .kmp-who{line-height:1.2;min-width:0}
  .kmp-who b{font-size:15px;display:block}
  .kmp-who small{font-size:12px;color:#c9c7c0;display:flex;align-items:center;gap:6px}
  .kmp-who small::before{content:"";width:7px;height:7px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 3px rgba(61,220,132,.2)}
  .kmp-logo-img{height:22px;width:auto;filter:invert(1);mix-blend-mode:screen;margin-left:auto;opacity:.95}
  .kmp-head-btns{display:flex;gap:6px;margin-left:8px}
  .kmp-voice-toggle{background:transparent;border:1px solid #3a3a3a;color:#fff;border-radius:999px;padding:6px 11px;font-size:12.5px}
  .kmp-voice-toggle[aria-pressed=true]{background:var(--y);border-color:var(--y);color:var(--k);font-weight:600}
  .kmp-x{background:none;border:0;color:#fff;font-size:26px;line-height:1;padding:0 4px}
  .kmp-who small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .kmp-voice-toggle{white-space:nowrap}
  .kmp-head-btns{margin-left:auto;flex:none}
  .kmp-logo-img+.kmp-head-btns{margin-left:8px}
  @media(max-width:480px){.kmp-logo-img{display:none}.kmp-head-btns{margin-left:auto!important}.kmp-hero{height:200px}.kmp-hero h2{font-size:23px}}

  /* --- zona de mensajes --- */
  .kmp-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 14px 8px;display:flex;flex-direction:column;gap:10px;background:var(--soft);scroll-behavior:smooth;overscroll-behavior:contain}
  .kmp-msgs>*{flex-shrink:0}
  .kmp-in{animation:kmp-in .35s cubic-bezier(.2,.8,.2,1) both}
  @keyframes kmp-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .kmp-row{display:flex;gap:8px;align-items:flex-end;max-width:88%}
  .kmp-msg{padding:11px 14px;border-radius:var(--r);line-height:1.45;font-size:15px;white-space:pre-wrap;word-wrap:break-word}
  .kmp-bot{background:#fff;border:1px solid var(--line);border-bottom-left-radius:6px}
  .kmp-user{background:var(--k);color:#fff;border-bottom-right-radius:6px;align-self:flex-end;max-width:82%}
  .kmp-dots{display:inline-flex;gap:4px;padding:14px 16px}
  .kmp-dots i{width:7px;height:7px;border-radius:50%;background:#b9b6ae;animation:kmp-dot 1.2s infinite}
  .kmp-dots i:nth-child(2){animation-delay:.15s}.kmp-dots i:nth-child(3){animation-delay:.3s}
  @keyframes kmp-dot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}
  .kmp-note{font-size:13px;color:var(--muted);align-self:center;text-align:center;padding:4px 10px}

  /* --- bienvenida --- */
  .kmp-welcome{margin:-18px -14px 4px;display:flex;flex-direction:column}
  .kmp-hero{position:relative;height:230px;background:#222 var(--kmp-bg) center/cover no-repeat;display:flex;align-items:flex-end;padding:18px;color:#fff}
  .kmp-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 20%,rgba(0,0,0,.75))}
  .kmp-hero div{position:relative;z-index:1}
  .kmp-hero small{display:inline-block;background:var(--y);color:var(--k);font-weight:700;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:6px;margin-bottom:8px}
  .kmp-hero h2{margin:0;font-size:26px;line-height:1.15;font-weight:800}
  .kmp-hero p{margin:6px 0 0;font-size:14.5px;opacity:.92}
  .kmp-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}
  .kmp-action{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;font-size:14.5px;font-weight:600;color:var(--text);transition:transform .15s,border-color .15s,box-shadow .15s}
  .kmp-action:hover{border-color:var(--k);transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.08)}
  .kmp-action span{width:34px;height:34px;border-radius:10px;background:var(--y);display:grid;place-items:center}
  .kmp-action.main{grid-column:1/-1;flex-direction:row;align-items:center;background:var(--k);color:#fff;border-color:var(--k)}
  .kmp-action.main em{margin-left:auto;font-style:normal;color:var(--y)}
  .kmp-welcome-tip{font-size:12.5px;color:var(--muted);text-align:center;padding:0 14px 6px}

  /* --- tarjetas --- */
  .kmp-card{background:#fff;border-radius:20px;padding:14px;border:1px solid var(--line);font-size:14px;align-self:stretch}
  .kmp-card h4{margin:0 0 10px;font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
  .kmp-no{color:var(--muted);font-size:12.5px}
  .kmp-price{font-size:17px}
  .kmp-head-line{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 2px 8px}
  .kmp-head-line h4{margin:0}
  .kmp-head-line .kmp-no{white-space:nowrap}

  /* carrusel */
  .kmp-carousel-wrap{align-self:stretch;margin:0 -14px}
  .kmp-carousel-wrap .kmp-head-line{margin:0 16px 8px}
  .kmp-carousel{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 16px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .kmp-carousel::-webkit-scrollbar{display:none}
  .kmp-tent{flex:0 0 250px;scroll-snap-align:start;background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;display:flex;flex-direction:column}
  .kmp-tent-img{position:relative;height:150px;border:0;padding:0;background:#ddd;cursor:zoom-in;display:block;width:100%}
  .kmp-tent-img img{width:100%;height:100%;object-fit:cover;display:block}
  .kmp-badge{position:absolute;left:10px;bottom:10px;background:#fff;color:var(--k);font-weight:800;font-size:15px;padding:5px 10px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,.18)}
  .kmp-badge small{font-weight:500;font-size:11px;color:var(--muted);margin-right:3px}
  .kmp-count{position:absolute;right:10px;top:10px;background:rgba(0,0,0,.65);color:#fff;font-size:11px;padding:3px 8px;border-radius:999px;backdrop-filter:blur(4px)}
  .kmp-tag{position:absolute;left:10px;top:10px;background:var(--y);color:var(--k);font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px}
  .kmp-tent-body{padding:12px;display:flex;flex-direction:column;gap:6px;flex:1}
  .kmp-tent-body b{font-size:15px;line-height:1.25}
  .kmp-why{font-size:12.5px;color:var(--text)}
  .kmp-tribe-sm{font-size:12px;color:var(--muted)}
  .kmp-tribe-sm::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--y);margin-right:5px;vertical-align:1px}
  .kmp-rates{display:flex;flex-direction:column;gap:6px;margin-top:auto;padding-top:4px}
  .kmp-rate{display:flex;justify-content:space-between;align-items:center;background:#fff;color:var(--k);border:1.5px solid var(--line);border-radius:12px;padding:9px 12px;font-size:13px;transition:background .15s,border-color .15s}
  .kmp-rate b{font-size:15px}
  .kmp-rate:hover,.kmp-rate:active{border-color:var(--k);background:var(--y)}
  .kmp-rate.main{background:var(--k);color:#fff;border-color:var(--k)}
  .kmp-rate.main b{color:var(--y)}
  .kmp-rate.main:hover{background:#222}

  /* lista (fechas) */
  .kmp-opt{display:flex;align-items:center;padding:10px 0;border-top:1px solid #f0efeb;gap:10px}
  .kmp-opt:first-of-type{border-top:0}
  .kmp-pill{background:var(--y);color:var(--k);border:0;border-radius:999px;padding:8px 14px;font-weight:700;font-size:13px;flex:none}
  .kmp-pill:hover{background:var(--k);color:var(--y)}

  /* reserva lista */
  .kmp-ok{border:2px solid var(--k);padding:0;overflow:hidden}
  .kmp-ok-img{height:120px;background:#ddd center/cover no-repeat;position:relative;border:0;width:100%;display:block;cursor:zoom-in}
  .kmp-ok-img span{position:absolute;left:12px;top:12px;background:var(--y);color:var(--k);font-weight:800;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:7px}
  .kmp-ok-body{padding:14px;line-height:1.5}
  .kmp-ok-body .kmp-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)}
  .kmp-ok-body .kmp-total b{font-size:22px}
  .kmp-switch{display:block;width:100%;margin-top:10px;background:#fff;border:1.5px solid var(--line);border-radius:999px;padding:9px;font-size:13px}
  .kmp-switch:hover{border-color:var(--k)}
  .kmp-cta{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;background:var(--k);color:var(--y);text-decoration:none;border-radius:999px;padding:13px;font-weight:800;font-size:15px}
  .kmp-cta:hover{background:#1d1d1d}

  /* --- entrada --- */
  .kmp-form{display:flex;gap:8px;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));background:#fff;align-items:center;border-top:1px solid var(--line)}
  .kmp-form input{flex:1;min-width:0;border:1.5px solid var(--line);background:var(--soft);border-radius:999px;padding:12px 16px;font-size:16px;outline:none;transition:border-color .15s,background .15s}
  .kmp-form input:focus{border-color:var(--k);background:#fff}
  .kmp-btn{width:46px;height:46px;border-radius:50%;border:0;display:grid;place-items:center;flex:none;transition:transform .15s}
  .kmp-btn:active{transform:scale(.92)}
  .kmp-send{background:var(--k);color:var(--y)}
  .kmp-mic{background:var(--y);color:var(--k);width:50px;height:50px}
  .kmp-foot{font-size:10.5px;color:#9a978f;text-align:center;padding:0 0 8px;background:#fff}

  /* --- modo voz --- */
  .kmp-voice{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(255,255,255,0),#fff 22%);padding:40px 16px max(18px,env(safe-area-inset-bottom));display:none;flex-direction:column;align-items:center;gap:12px;z-index:4}
  .kmp-voice.on{display:flex;animation:kmp-in .25s ease both}
  .kmp-orb{position:relative;width:96px;height:96px;display:grid;place-items:center}
  .kmp-orb b{position:relative;z-index:2;width:72px;height:72px;border-radius:50%;background:var(--y);display:grid;place-items:center;box-shadow:0 10px 30px rgba(255,209,0,.55)}
  .kmp-orb i{position:absolute;inset:12px;border-radius:50%;background:var(--y);opacity:.35}
  .kmp-voice.escucha .kmp-orb i{animation:kmp-ring 1.6s infinite}
  .kmp-voice.escucha .kmp-orb i:nth-of-type(2){animation-delay:.5s}
  .kmp-voice.habla .kmp-orb b{animation:kmp-breathe .9s ease-in-out infinite}
  .kmp-voice.habla .kmp-orb i{animation:kmp-ring 1.1s infinite}
  .kmp-voice.habla .kmp-orb i:nth-of-type(2){animation-delay:.35s}
  .kmp-voice.piensa .kmp-orb b{animation:kmp-spin 1.2s linear infinite;background:conic-gradient(var(--y) 0 70%,#fff3b0 70% 100%)}
  @keyframes kmp-ring{0%{transform:scale(.8);opacity:.5}100%{transform:scale(1.6);opacity:0}}
  @keyframes kmp-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
  @keyframes kmp-spin{to{transform:rotate(1turn)}}
  .kmp-voice-label{font-weight:700;font-size:15px}
  .kmp-voice-text{font-size:14px;color:var(--muted);text-align:center;min-height:20px;max-width:90%}
  .kmp-voice-stop{background:#fff;border:1.5px solid var(--line);border-radius:999px;padding:9px 18px;font-size:13.5px;font-weight:600}
  .kmp-voice-stop:hover{border-color:var(--k)}

  /* --- pago y galería --- */
  .kmp-pay{position:absolute;inset:0;background:#fff;display:none;flex-direction:column;z-index:6}
  .kmp-pay.on{display:flex;animation:kmp-in .25s ease both}
  .kmp-pay-bar{display:flex;align-items:center;justify-content:space-between;background:var(--k);padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top))}
  .kmp-pay-back{background:var(--y);color:var(--k);border:0;border-radius:999px;padding:8px 14px;font-weight:700}
  .kmp-pay-ext{color:#ddd;font-size:12.5px;text-decoration:none}
  .kmp-pay iframe{flex:1;width:100%;border:0}
  .kmp-gal{position:absolute;inset:0;background:rgba(0,0,0,.95);display:none;flex-direction:column;z-index:7;color:#fff}
  .kmp-gal.on{display:flex;animation:kmp-in .2s ease both}
  .kmp-gal-top{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;font-weight:600;padding-top:max(12px,env(safe-area-inset-top))}
  .kmp-gal-top button{background:none;border:0;color:#fff;font-size:28px;line-height:1}
  .kmp-gal-main{flex:1;display:flex;align-items:center;justify-content:center;position:relative;min-height:0}
  .kmp-gal-main img{max-width:100%;max-height:100%;object-fit:contain}
  .kmp-gal-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:var(--y);color:#000;font-size:22px}
  .kmp-gal-prev{left:10px}.kmp-gal-next{right:10px}
  .kmp-gal-dots{display:flex;gap:6px;overflow-x:auto;padding:10px 14px max(12px,env(safe-area-inset-bottom))}
  .kmp-gal-dots img{width:56px;height:42px;object-fit:cover;border-radius:6px;opacity:.45;cursor:pointer;flex:none}
  .kmp-gal-dots img.on{opacity:1;outline:2px solid var(--y)}
  @media (prefers-reduced-motion: reduce){.kmp-root *{animation:none!important;transition:none!important}}
  `;

  // Iconos (trazo, sin dependencias)
  const svg = (p, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const icon = {
    chat: svg('<path d="M3 20l1.5-4.5A8 8 0 1 1 8 19.5L3 20z"/>', 28),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 22),
    send: svg('<path d="M4 12h15M13 6l6 6-6 6"/>', 18),
    cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 18),
    tent: svg('<path d="M12 3L2 21h20L12 3z"/><path d="M12 3l4 18M12 3L8 21"/>', 18),
    car: svg('<path d="M5 16l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><circle cx="7" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>', 18),
    tree: svg('<path d="M12 2l5 7h-3l4 6H6l4-6H7l5-7z"/><path d="M12 15v7"/>', 18),
    // marca de Kampi: dos "picos" como en el logo de Kampaoh
    kampi: '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l8-7 8 7"/><path d="M7 18l5-4.5 5 4.5"/></svg>',
  };

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.className = "kmp-root " + (FULL ? "kmp-full" : "kmp-float");
  root.innerHTML = `
    <div class="kmp-panel" role="dialog" aria-label="Asistente Kampaoh">
      <div class="kmp-head">
        <div class="kmp-ava">${icon.kampi}</div>
        <div class="kmp-who"><b>Kampi</b><small class="kmp-status">En línea · Kampaoh Córdoba</small></div>
        <img class="kmp-logo-img" src="${API}/logo.png" alt="Kampaoh">
        <div class="kmp-head-btns">
          <button class="kmp-voice-toggle" aria-pressed="true" title="Quitar o poner la voz">🔊 Voz</button>
          ${FULL ? "" : '<button class="kmp-x" aria-label="Cerrar">×</button>'}
        </div>
      </div>
      <div class="kmp-msgs" aria-live="polite"></div>
      <form class="kmp-form">
        <input placeholder="Escribe o pulsa el micro…" aria-label="Mensaje" enterkeyhint="send" autocomplete="off" />
        <button class="kmp-btn kmp-send" aria-label="Enviar">${icon.send}</button>
        <button type="button" class="kmp-btn kmp-mic" aria-label="Hablar">${icon.mic}</button>
      </form>
      <div class="kmp-foot kmp-mode"></div>
      <div class="kmp-voice" aria-live="polite">
        <div class="kmp-orb"><i></i><i></i><b>${icon.mic}</b></div>
        <div class="kmp-voice-label">Te escucho…</div>
        <div class="kmp-voice-text"></div>
        <button type="button" class="kmp-voice-stop">Parar</button>
      </div>
    </div>
    ${FULL ? "" : `<button class="kmp-fab" aria-label="Abrir asistente">${icon.chat}</button>`}`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const msgs = $(".kmp-msgs"), input = $("input"), micBtn = $(".kmp-mic"), voiceBtn = $(".kmp-voice-toggle"), status = $(".kmp-status");
  const voiceUI = $(".kmp-voice"), voiceLabel = $(".kmp-voice-label"), voiceText = $(".kmp-voice-text");
  const idleStatus = status.textContent;
  // Voz activada por defecto; el usuario puede quitarla con el botón "Voz" (se recuerda en este navegador)
  let speakReplies = (() => { try { return localStorage.getItem("kmp-voz") !== "off"; } catch { return true; } })();
  let busy = false, conversationMode = false, serverTTS = false;

  const scrollAbajo = () => requestAnimationFrame(() => (msgs.scrollTop = msgs.scrollHeight));
  const add = (cls, html) => {
    const el = document.createElement("div");
    el.className = cls + " kmp-in";
    el.innerHTML = html;
    msgs.appendChild(el);
    scrollAbajo();
    return el;
  };
  // Mensaje de Kampi con su avatar
  const addBot = (html) => add("kmp-row", `<div class="kmp-ava kmp-ava-sm">${icon.kampi}</div><div class="kmp-msg kmp-bot">${html}</div>`);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const eur = (n) => (Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")) + " €";
  const etiqueta = (t) => (String(t).toUpperCase() === "FLEX" ? "Cancelación gratis" : String(t).toUpperCase() === "SMART" ? "No reembolsable" : t);

  // ---------- Galerías ----------
  const galerias = {};
  const registrarGaleria = (o) => {
    const id = "g" + (o.id || o.roomTypeId || o.alojamiento_id);
    galerias[id] = { nombre: o.nombre || o.alojamiento, fotos: o.fotos?.length ? o.fotos : [o.imagen] };
    return id;
  };

  // ---------- Tarjetas ----------
  // Una tienda en el carrusel: foto grande, precio encima, datos y botones de tarifa
  function tarjetaTienda(o, { tarifas = [], por = [], destacada = false } = {}) {
    const gid = o.imagen ? registrarGaleria(o) : null;
    const nFotos = gid ? galerias[gid].fotos.length : 0;
    const desde = tarifas.length ? Math.min(...tarifas.map((t) => t.total)) : null;
    const tags = [o.capacidad && `hasta ${o.capacidad} pers.`, o.m2 && `${o.m2} m²`, o.bano_privado && "baño privado", o.aire_acondicionado && "aire acond.", o.mascotas && "admite perros"].filter(Boolean).join(" · ");
    const pick = (t) => `Me quedo con la ${o.nombre}, ${etiqueta(t.tarifa).toLowerCase()}`;
    const botones = tarifas
      .map((t, i) => `<button class="kmp-rate${i === 0 ? " main" : ""}" data-send="${esc(pick(t))}"><span>${etiqueta(t.tarifa)}</span><b>${eur(t.total)}</b></button>`)
      .join("");
    return `<div class="kmp-tent">
      ${o.imagen ? `<button class="kmp-tent-img" data-gal="${gid}" aria-label="Ver fotos de ${esc(o.nombre)}"><img src="${esc(o.imagen)}" alt="" loading="lazy">
        ${destacada ? '<span class="kmp-tag">Recomendada</span>' : ""}${nFotos > 1 ? `<span class="kmp-count">${nFotos} fotos</span>` : ""}
        ${desde != null ? `<span class="kmp-badge"><small>desde</small>${eur(desde)}</span>` : ""}</button>` : ""}
      <div class="kmp-tent-body">
        <b>${esc(o.nombre)}</b>
        <span class="kmp-no">${tags}</span>
        ${por.length ? `<span class="kmp-why">${esc(por.slice(0, 3).join(" · "))}</span>` : ""}
        ${desde != null ? `<span class="kmp-tribe-sm">−5 % con Kampaoh Tribe</span>` : ""}
        ${botones ? `<div class="kmp-rates">${botones}</div>` : ""}
      </div></div>`;
  }
  const carrusel = (titulo, extra, items) =>
    add("kmp-carousel-wrap", `<div class="kmp-head-line"><h4>${titulo}</h4>${extra ? `<span class="kmp-no">${extra}</span>` : ""}</div><div class="kmp-carousel">${items}</div>`);

  function renderEvent(ev) {
    const d = ev.data;
    if (ev.type === "consultar_disponibilidad" && d.opciones) {
      const libres = d.opciones.filter((o) => o.disponible);
      const full = d.opciones.length - libres.length;
      if (!libres.length) return add("kmp-card", `<h4>${fmtDate(d.entrada)} → ${fmtDate(d.salida)}</h4><span class="kmp-no">Sin disponibilidad en esas fechas</span>`);
      carrusel(
        `${fmtDate(d.entrada)} → ${fmtDate(d.salida)} · ${d.noches} noches · ${d.adultos + (d.ninos || 0)} pers.${d.mascota ? " · 🐶" : ""}`,
        `${libres.length} libres${full ? ` · ${full} completas` : ""}`,
        libres.map((o) => tarjetaTienda(o, { tarifas: o.tarifas })).join("")
      );
    }
    if (ev.type === "recomendacion" && d.tiendas) {
      carrusel(esc(d.titulo), "desliza →", d.tiendas.map((t, i) => tarjetaTienda(t, { por: t.por, destacada: i === 0 && d.tiendas.length < 6 })).join(""));
    }
    if (ev.type === "fechas_baratas" && d.mas_baratas) {
      const mesNom = d.titulo || new Date(Date.UTC(d.anio, d.mes - 1, 15)).toLocaleDateString("es-ES", { month: "long" });
      const dia = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
      const rows = d.mas_baratas.map((f) => {
        const txt = `Del ${new Date(f.entrada + "T12:00:00").getDate()} al ${new Date(f.salida + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`;
        return `<div class="kmp-opt"><div style="flex:1;min-width:0"><b>${dia(f.entrada)} → ${dia(f.salida)}</b><br>
          <span class="kmp-no">desde <b style="color:#111">${eur(f.total)}</b> · ${esc(f.tienda)} · ${f.opciones_libres} libres</span></div>
          <button class="kmp-pill" data-send="${esc(txt)}">Elegir</button></div>`;
      }).join("");
      add("kmp-card", `<h4>Fechas más baratas · ${esc(mesNom)} · ${d.noches} noches</h4>${rows || '<span class="kmp-no">Sin disponibilidad</span>'}`);
    }
    if (ev.type === "preparar_reserva" && d.enlace) {
      const otra = (d.otras_tarifas || [])[0];
      const gid = d.imagen ? registrarGaleria({ ...d, id: d.alojamiento_id, nombre: d.alojamiento }) : "";
      add("kmp-card kmp-ok", `
        <button class="kmp-ok-img" data-gal="${gid}" style="background-image:url('${esc(d.imagen || "")}')" aria-label="Ver fotos"><span>Tu reserva</span></button>
        <div class="kmp-ok-body">
          <b style="font-size:16px">${esc(d.alojamiento)}</b><br>
          <span class="kmp-no">${fmtDate(d.entrada)} → ${fmtDate(d.salida)} · ${d.noches} noches · ${d.adultos + (d.ninos || 0)} pers.</span>
          <div class="kmp-total"><span>${etiqueta(d.tarifa)}<br><span class="kmp-no">${esc(d.cancelacion || "")}</span></span><b>${eur(d.total)}</b></div>
          ${d.total_tribe ? `<div class="kmp-tribe-sm" style="margin-top:6px">Con Kampaoh Tribe: ${eur(d.total_tribe)} o menos, iniciando sesión al pagar</div>` : ""}
          ${otra ? `<button class="kmp-switch" data-send="${esc(`Me quedo con la ${d.alojamiento}, ${etiqueta(otra.tarifa).toLowerCase()}`)}">Prefiero ${etiqueta(otra.tarifa).toLowerCase()}: ${eur(otra.total)}</button>` : ""}
          <a class="kmp-cta" href="${esc(d.enlace)}" data-checkout="${esc(d.enlace)}" target="_blank" rel="noopener">Reservar y pagar aquí →</a>
        </div>`);
    }
  }

  // ---------- Bienvenida ----------
  let welcome = null;
  function mostrarBienvenida() {
    if (welcome || msgs.children.length) return;
    welcome = add("kmp-welcome", `
      <div class="kmp-hero"><div>
        <small>Kampaoh Córdoba</small>
        <h2>¡Hola! Soy Kampi 👋</h2>
        <p>Te ayudo a elegir tienda, resolver dudas y reservar. Escríbeme o háblame.</p>
      </div></div>
      <div class="kmp-actions">
        <button class="kmp-action main" data-send="Quiero reservar"><span>${icon.cal}</span>Quiero reservar<em>→</em></button>
        <button class="kmp-action" data-send="¿Cómo son las tiendas?"><span>${icon.tent}</span>¿Cómo son las tiendas?</button>
        <button class="kmp-action" data-send="¿Tiene parking?"><span>${icon.car}</span>¿Tiene parking?</button>
        <button class="kmp-action" data-send="¿Qué hay en el camping?" style="grid-column:1/-1;flex-direction:row;align-items:center"><span>${icon.tree}</span>¿Qué hay en el camping?</button>
      </div>
      <div class="kmp-welcome-tip">Pulsa el micro amarillo para hablar con Kampi</div>`);
  }
  // Al empezar la conversación, la bienvenida se recoge para dejar sitio
  function recogerBienvenida() {
    if (!welcome) return;
    const w = welcome;
    welcome = null;
    w.style.transition = "opacity .25s, max-height .35s";
    w.style.maxHeight = w.offsetHeight + "px";
    w.style.overflow = "hidden";
    requestAnimationFrame(() => { w.style.opacity = "0"; w.style.maxHeight = "0px"; });
    setTimeout(() => w.remove(), 380);
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

  // ---------- Panel de voz (círculo animado) ----------
  function estadoVoz(modo, texto = "") {
    voiceUI.classList.remove("escucha", "habla", "piensa");
    if (!modo || !conversationMode) { voiceUI.classList.remove("on"); return; }
    voiceUI.classList.add("on", modo);
    voiceLabel.textContent = modo === "escucha" ? "Te escucho…" : modo === "habla" ? "Kampi está hablando…" : "Pensando…";
    voiceText.textContent = texto;
  }
  $(".kmp-voice-stop").onclick = () => { conversationMode = false; stopSpeaking(); stopListening(); estadoVoz(null); };

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
      setTimeout(() => { try { synth.resume(); } catch {} }, 250); // Chrome Android a veces se queda "pausado"
    });

  async function speak(text) {
    if (!speakReplies || !text) return;
    stopSpeaking();
    status.textContent = "Hablando…";
    estadoVoz("habla", text.length > 140 ? text.slice(0, 137) + "…" : text);
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
      if (!hecho) await hablarNavegador(text);
    } catch {}
    status.textContent = idleStatus;
    if (!listening) estadoVoz(null);
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
      voiceText.textContent = r;
      if (e.results[e.results.length - 1].isFinal) { stopListening(); send(r); }
    };
    rec.onerror = (e) => {
      stopListening();
      conversationMode = false;
      estadoVoz(null);
      if (e.error === "not-allowed") add("kmp-note", "Para hablar, permite el uso del micrófono en el navegador.");
    };
    rec.onend = () => { if (listening) { stopListening(); if (!busy) estadoVoz(null); } };
  } else {
    micBtn.title = "Tu navegador no permite dictado por voz (prueba Chrome, Edge o Safari)";
    micBtn.style.opacity = 0.4;
  }
  function startListening() {
    if (!rec || listening) return;
    stopSpeaking();
    listening = true;
    status.textContent = "Escuchando…";
    estadoVoz("escucha");
    try { rec.start(); } catch {}
  }
  function stopListening() {
    listening = false;
    status.textContent = idleStatus;
    try { rec.stop(); } catch {}
  }
  micBtn.onclick = () => {
    if (!rec) return;
    conversationMode = true; // escucha → responde en voz alta → vuelve a escuchar
    if (!speakReplies) toggleVoice(true);
    startListening();
  };
  function toggleVoice(on) {
    speakReplies = on ?? !speakReplies;
    try { localStorage.setItem("kmp-voz", speakReplies ? "on" : "off"); } catch {}
    voiceBtn.setAttribute("aria-pressed", speakReplies);
    voiceBtn.textContent = speakReplies ? "🔊 Voz" : "🔈 Voz";
    if (!speakReplies) { stopSpeaking(); conversationMode = false; estadoVoz(null); }
  }
  voiceBtn.onclick = () => toggleVoice();
  toggleVoice(speakReplies);

  // ---------- Chat ----------
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    recogerBienvenida();
    add("kmp-msg kmp-user", esc(text));
    const typing = add("kmp-row", `<div class="kmp-ava kmp-ava-sm">${icon.kampi}</div><div class="kmp-msg kmp-bot kmp-dots"><i></i><i></i><i></i></div>`);
    status.textContent = "Escribiendo…";
    estadoVoz("piensa", text);
    try {
      const r = await fetch(API + "/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: text, destino: (me && me.dataset.destino) || "cordoba" }),
      }).then((x) => x.json());
      typing.remove();
      status.textContent = idleStatus;
      (r.events || []).forEach(renderEvent);
      addBot(esc(r.text || "Perdona, no te he entendido."));
      busy = false;
      await speak(r.text || "");
      if (conversationMode && !(r.events || []).some((e) => e.type === "preparar_reserva")) startListening();
      else estadoVoz(null);
    } catch {
      typing.remove();
      status.textContent = idleStatus;
      addBot("Uy, se ha cortado la conexión. ¿Lo intentas de nuevo?");
      busy = false;
      estadoVoz(null);
    }
  }

  $(".kmp-form").onsubmit = (e) => { e.preventDefault(); conversationMode = false; estadoVoz(null); send(input.value); };

  // ---------- Checkout oficial de Kampaoh dentro del asistente ----------
  const pay = document.createElement("div");
  pay.className = "kmp-pay";
  pay.innerHTML = `<div class="kmp-pay-bar"><button class="kmp-pay-back">← Volver al chat</button>
    <a class="kmp-pay-ext" target="_blank" rel="noopener">Abrir en pestaña nueva ↗</a></div><iframe title="Pago Kampaoh" allow="payment *"></iframe>`;
  $(".kmp-panel").appendChild(pay);
  const openCheckout = (url) => {
    stopListening(); stopSpeaking(); conversationMode = false; estadoVoz(null);
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
    gal.querySelectorAll(".kmp-gal-nav").forEach((b) => (b.style.display = galFotos.length > 1 ? "" : "none"));
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
    if (th && th.dataset.gal) return openGal(th.dataset.gal);
    const co = e.target.closest("[data-checkout]");
    if (co) { e.preventDefault(); return openCheckout(co.dataset.checkout); }
    const b = e.target.closest("[data-send]");
    if (b) send(b.dataset.send);
  };

  // ---------- Móvil: que el teclado no tape la caja de escribir ----------
  if (FULL && window.visualViewport) {
    const ajustar = () => root.style.setProperty("--kmp-vh", window.visualViewport.height + "px");
    window.visualViewport.addEventListener("resize", ajustar);
    ajustar();
    input.addEventListener("focus", () => setTimeout(scrollAbajo, 300));
  }

  const toggle = (open) => {
    if (FULL) return;
    root.classList.toggle("kmp-open", open);
    if (open) { mostrarBienvenida(); input.focus(); } else { stopListening(); stopSpeaking(); estadoVoz(null); }
  };
  if (FULL) mostrarBienvenida();
  else {
    $(".kmp-fab").onclick = () => toggle(!root.classList.contains("kmp-open"));
    $(".kmp-x").onclick = () => toggle(false);
  }

  fetch(API + "/api/info").then((r) => r.json()).then((i) => {
    serverTTS = i.tts === "elevenlabs";
    $(".kmp-mode").textContent = (i.mode === "ia" ? "Asistente con IA" : "Modo demo") + " · disponibilidad y precios reales" + (serverTTS ? " · voz natural" : "");
    const foto = i.destino && i.destino.foto;
    if (foto) {
      root.style.setProperty("--kmp-bg", `url("${foto}")`);
      const pre = new Image();
      pre.onload = () => root.classList.add("kmp-hasbg");
      pre.src = foto;
    }
  }).catch(() => {});
  window.KampaohAsistente = {
    open: () => toggle(true),
    close: () => toggle(false),
    // Para probar el aspecto del modo voz sin micrófono: KampaohAsistente.verVoz("escucha" | "habla" | "piensa" | null)
    verVoz: (modo, texto) => { conversationMode = !!modo; estadoVoz(modo, texto); },
  };
})();
