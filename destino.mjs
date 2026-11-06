// Conexión con las APIs públicas de Kampaoh (las mismas que usa booking.kampaoh.com):
//  - CMS (Strapi):        https://cms-cdn.prod.kampaoh.com/api/campings/:id, /api/tents   → info del destino y de cada tienda
//  - Disponibilidad:      https://api.prod.kampaoh.com/api/v3/properties/:pid/rooms/boards/plans → tiendas libres y precios
//  - Reserva y pago:      se completan en https://booking.kampaoh.com/property/:pid (enlace con fechas y huéspedes ya puestos)

const CMS = "https://cms-cdn.prod.kampaoh.com/api";
const API = "https://api.prod.kampaoh.com/api/v3";
const BOOKING = "https://booking.kampaoh.com";

// Destinos soportados (CMS id → id de propiedad en el motor de reservas = ulysesId)
export const DESTINOS = { cordoba: { cmsId: 2, propertyId: 30 } };
const DEST = DESTINOS.cordoba;

const stripMd = (s = "") => s.replace(/[#*_>`]/g, "").replace(/\n{3,}/g, "\n\n").trim();

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

// ---------- Info del destino (cacheada 1 h) ----------
let cache = { at: 0, data: null };

export async function getDestino() {
  if (cache.data && Date.now() - cache.at < 3600_000) return cache.data;
  const qs = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const [camp, tents] = await Promise.all([
    getJSON(`${CMS}/campings/${DEST.cmsId}?${qs({ locale: "es", "populate[description]": "*", "populate[condition]": "*", "populate[features][fields][0]": "name", "populate[featuredImage][fields][0]": "url", "populate[featuredImage][fields][1]": "formats", "populate[photos][fields][0]": "url", "populate[photos][fields][1]": "formats" })}`),
    getJSON(
      `${CMS}/tents?${qs({
        "filters[camping][id][$eq]": DEST.cmsId,
        "pagination[pageSize]": 50,
        locale: "es",
        "populate[features][fields][0]": "name",
        "populate[tent_description]": "*",
        "populate[tent_model]": "*",
        "populate[featuredImage][fields][0]": "url",
        "populate[images][fields][0]": "url",
        "populate[images][fields][1]": "formats",
      })}`
    ),
  ]);
  const c = camp.data;
  const img = (u) => (!u ? null : u.startsWith("http") ? u : "https://cms-cdn.prod.kampaoh.com" + u);
  const nombreDe = (t) => {
    let n = (t.tent_model?.name || t.name).trim().replace(/\s+Córdoba$/, "")
      .replace(/\s*\((Baño privado|Baño Privado)\)/i, " con baño privado")
      .replace(/\s*\(Baño privado \+ Bañera exterior\)/i, " con baño y bañera exterior")
      .replace(/\s*\+\s*Baño privado/i, " con baño privado");
    if (t.pets && !/mascota/i.test(n)) n += " (admite mascotas)";
    if (t.isAC && !/aire|A\/C/i.test(n)) n += " con aire acondicionado";
    return n;
  };
  const tiendas = tents.data.map((t) => ({
    roomTypeId: Number(t.roomTypeId),
    nombre: nombreDe(t),
    capacidad: t.tent_model?.maxGuests ?? null,
    m2: t.tent_model?.area ?? null,
    bano_privado: !!t.privateBathroom,
    mascotas: !!t.pets,
    aire_acondicionado: !!t.isAC || (t.features || []).some((f) => /aire acondicionado/i.test(f.name)),
    equipamiento: (t.features || []).map((f) => f.name),
    descripcion: stripMd(t.tent_description?.description || "").slice(0, 600),
    imagen: img(t.featuredImage?.url),
    fotos: [...new Set([img(t.featuredImage?.url), ...(t.images || []).map((i) => img(i.formats?.large?.url || i.formats?.medium?.url || i.url))].filter(Boolean))],
  }));
  cache = {
    at: Date.now(),
    data: {
      nombre: c.propertyName,
      foto: img(c.featuredImage?.formats?.large?.url || c.featuredImage?.url),
      fotos: (c.photos || []).map((p) => img(p.formats?.large?.url || p.url)).filter(Boolean),
      camping: c.campingName,
      ubicacion: c.location,
      coordenadas: [c.latitude, c.longitude],
      valoracion: `${c.score}/10 (${c.reviews} opiniones)`,
      servicios: (c.features || []).map((f) => f.name),
      descripcion: stripMd(c.description?.description),
      condiciones: stripMd(c.condition?.description),
      recepcion: c.horarioRecepcion,
      hora_limite_reserva_mismo_dia: c.timeLimitForBooking,
      abierto: { desde: c.openFrom?.slice(0, 10), hasta: c.openTo?.slice(0, 10) },
      tiendas,
    },
  };
  return cache.data;
}

// ---------- Tarifas que vende la web para una tienda (FLEX y/o SMART, con sus IDs) ----------
export const TRIBE_DESCUENTO_MIN = 0.05; // Kampaoh Tribe: desde un 5 % (nivel 1) al iniciar sesión
const redondea = (n) => Math.round(n * 100) / 100;

export async function tarifasTienda({ room, entrada, salida, adultos, ninos = 0 }) {
  const j = await getJSON(`${API}/properties/${DEST.propertyId}/rooms/${room}/boards/plans?adults=${adultos}&children=${ninos}&startDate=${entrada}&endDate=${salida}&lang=es`);
  return (j.data || [])
    .flatMap((b) =>
      (b.plans || [])
        .filter((p) => p.available !== false)
        .map((p) => ({
          tarifa: p.rateName, // FLEX / SMART
          rateId: p.rateId,
          boardId: b.id,
          regimen: b.name,
          total: p.totalPrice,
          total_tribe: redondea(p.totalPrice * (1 - TRIBE_DESCUENTO_MIN)),
          cancelacion: p.propertyPolicy?.name,
          no_reembolsable: !!p.propertyPolicy?.nonRefundable,
          deposito_pct: p.propertyPolicy?.depositPercentage ?? null,
        }))
    )
    .sort((a, b) => (a.tarifa === "FLEX" ? -1 : 1) - (b.tarifa === "FLEX" ? -1 : 1));
}

// ---------- Disponibilidad y precios en tiempo real ----------
export async function consultarDisponibilidad({ entrada, salida, adultos, ninos = 0, bebes = 0, mascota = false, soloResumen = false }) {
  const noches = Math.round((new Date(salida) - new Date(entrada)) / 86400000);
  if (!(noches >= 1)) throw new Error("Fechas no válidas: la salida debe ser posterior a la entrada");
  const [dest, disp] = await Promise.all([
    getDestino(),
    getJSON(`${API}/properties/${DEST.propertyId}/rooms/boards/plans?adults=${adultos}&children=${ninos}&startDate=${entrada}&endDate=${salida}&lang=es`),
  ]);
  if (!disp.success) throw new Error("El motor de reservas no ha respondido correctamente");
  const byId = Object.fromEntries(dest.tiendas.map((t) => [t.roomTypeId, t]));

  const opciones = disp.data
    .map((room) => {
      const info = byId[room.id] || {};
      const tarifas = room.boards.flatMap((b) =>
        b.plans.map((p) => ({
          tarifa: p.name, // FLEX / SMART
          regimen: b.name,
          total: Math.round(p.totalPrice * 100) / 100,
          media_noche: p.avgPrice,
          cancelacion: p.propertyPolicy?.name,
          no_reembolsable: !!p.propertyPolicy?.nonRefundable,
        }))
      );
      return {
        id: room.id,
        nombre: info.nombre || room.name,
        capacidad: info.capacidad,
        bano_privado: info.bano_privado,
        mascotas: info.mascotas ?? /mascota/i.test(room.name),
        aire_acondicionado: info.aire_acondicionado,
        imagen: info.imagen, fotos: info.fotos || [], m2: info.m2,
        disponible: tarifas.length > 0,
        desde: tarifas.length ? Math.min(...tarifas.map((t) => t.total)) : null,
        tarifas,
      };
    })
    .filter((o) => (mascota ? o.mascotas : true));

  // Tarifas reales de la web (FLEX y/o SMART) para las tiendas con hueco, en paralelo
  if (!soloResumen)
    await Promise.all(
      opciones.filter((o) => o.disponible).map(async (o) => {
        try {
          const t = await tarifasTienda({ room: o.id, entrada, salida, adultos, ninos });
          o.tarifas = t;
          o.disponible = t.length > 0;
          o.desde = t.length ? Math.min(...t.map((x) => x.total)) : null;
          o.desde_tribe = t.length ? Math.min(...t.map((x) => x.total_tribe)) : null;
        } catch {}
      })
    );
  opciones.sort((a, b) => (b.disponible - a.disponible) || (a.desde ?? 1e9) - (b.desde ?? 1e9));

  return {
    tribe: { descuento_desde: TRIBE_DESCUENTO_MIN, nota: "Miembros de Kampaoh Tribe: desde un 5 % de descuento iniciando sesión" },
    destino: dest.nombre,
    entrada,
    salida,
    noches,
    adultos,
    ninos,
    bebes,
    mascota,
    opciones,
    enlace_reserva: enlaceReserva({ entrada, salida, adultos, ninos, bebes }),
  };
}

// ---------- Fechas más baratas de un mes ----------
// Recorre cada posible fecha de entrada del mes (desde hoy) y devuelve las combinaciones más económicas.
export async function buscarFechasBaratas({ mes, anio, desde, hasta, noches = 2, adultos = 2, ninos = 0, bebes = 0, mascota = false, solo_fines_de_semana = false, max = 3 }) {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  // Rango: un mes entero, o fechas de entrada entre `desde` y `hasta` (p. ej. "la semana que viene")
  let ini, fin;
  if (desde) {
    ini = new Date(desde + "T00:00:00Z");
    fin = new Date((hasta || desde) + "T00:00:00Z");
    mes = ini.getUTCMonth() + 1;
    anio = ini.getUTCFullYear();
  } else {
    anio ||= mes < hoy.getUTCMonth() + 1 ? hoy.getUTCFullYear() + 1 : hoy.getUTCFullYear();
    ini = new Date(Date.UTC(anio, mes - 1, 1));
    fin = new Date(Date.UTC(anio, mes, 0));
  }
  const inicios = [];
  for (let d = new Date(ini); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d < new Date(hoy.getTime() + 86400000)) continue; // desde mañana
    if (solo_fines_de_semana && d.getUTCDay() !== 5) continue; // entrada en viernes
    inicios.push(new Date(d));
  }
  const resultados = [];
  const cola = [...inicios];
  const worker = async () => {
    while (cola.length) {
      const d = cola.shift();
      const s = new Date(d);
      s.setUTCDate(s.getUTCDate() + noches);
      try {
        const r = await consultarDisponibilidad({ entrada: iso(d), salida: iso(s), adultos, ninos, bebes, mascota, soloResumen: true });
        const best = r.opciones.filter((o) => o.disponible)[0];
        if (best) resultados.push({ entrada: r.entrada, salida: r.salida, noches, total: best.desde, tienda: best.nombre, tienda_id: best.id, opciones_libres: r.opciones.filter((o) => o.disponible).length });
      } catch {}
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker)); // máx. 5 consultas a la vez
  resultados.sort((a, b) => a.total - b.total || a.entrada.localeCompare(b.entrada));
  return { mes, anio, noches, adultos, ninos, mascota, fechas_consultadas: inicios.length, mas_baratas: resultados.slice(0, max), sin_disponibilidad: inicios.length - resultados.length };
}

export function enlaceReserva({ entrada, salida, adultos, ninos = 0, bebes = 0 }) {
  const q = new URLSearchParams({ checkin: entrada, checkout: salida, adults: adultos, children: ninos, babies: bebes, lang: "es" });
  return `${BOOKING}/property/${DEST.propertyId}?${q}`;
}

// ---------- "Reserva": enlace DIRECTO a la página de pago con todo seleccionado ----------
// booking.kampaoh.com/checkout?property=30&room=<tienda>&rate=<rateId>&board=<boardId>&checkin…&adults…
// El rateId solo lo da el endpoint por tienda (/rooms/:room/boards/plans), que además devuelve
// exactamente las tarifas que vende la web. El cliente solo rellena sus datos y paga (Stripe).
export async function prepararReserva({ alojamiento_id, tarifa, entrada, salida, adultos, ninos = 0, bebes = 0 }) {
  const room = Number(alojamiento_id);
  const [dest, tarifas] = await Promise.all([getDestino(), tarifasTienda({ room, entrada, salida, adultos, ninos })]);
  if (!tarifas.length) throw new Error("Ese alojamiento ya no está disponible en esas fechas");
  const want = String(tarifa || "").toUpperCase();
  const t = tarifas.find((x) => x.tarifa?.toUpperCase() === want) || tarifas[0]; // por defecto FLEX si existe
  const info = dest.tiendas.find((x) => x.roomTypeId === room) || {};
  const q = new URLSearchParams({
    checkin: entrada, checkout: salida, property: DEST.propertyId, lang: "es",
    room, rate: t.rateId, board: t.boardId, adults: adultos, children: ninos, babies: bebes,
  });
  const noches = Math.round((new Date(salida) - new Date(entrada)) / 86400000);
  return {
    alojamiento: info.nombre || `Tienda ${room}`,
    alojamiento_id: room,
    imagen: info.imagen, fotos: info.fotos || [],
    entrada, salida, noches, adultos, ninos, bebes,
    tarifa: t.tarifa,
    tarifa_pedida_no_disponible: want && t.tarifa?.toUpperCase() !== want ? want : undefined,
    otras_tarifas: tarifas.filter((x) => x !== t).map((x) => ({ tarifa: x.tarifa, total: x.total, total_tribe: x.total_tribe, cancelacion: x.cancelacion })),
    cancelacion: t.cancelacion,
    no_reembolsable: t.no_reembolsable,
    total: t.total,
    total_tribe: t.total_tribe,
    tribe_nota: "Si eres de Kampaoh Tribe, inicia sesión en la página de pago: desde un 5 % de descuento.",
    enlace: `${BOOKING}/checkout?${q}`,
  };
}
