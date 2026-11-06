// Modo demo SIN IA: flujo guiado con reglas sencillas para probar la UI y la voz sin API key.
// Usa disponibilidad y precios REALES de Kampaoh; las respuestas a preguntas salen de conocimiento/cordoba.md.
// Con ANTHROPIC_API_KEY el servidor usa Claude, que entiende cualquier forma de preguntar.

import { consultarDisponibilidad, prepararReserva, buscarFechasBaratas, getDestino } from "./destino.mjs";
import { leerPreferencias, recomendar, hayPreferencias, describirPreferencias } from "./recomendador.mjs";

const lista = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " y " + xs.at(-1) : xs[0] || "");

const NOMBRE_MES = Object.fromEntries(Object.entries(MESES_BASE()).map(([k, v]) => [v, k]));
function MESES_BASE() {
  return { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
}
function parseMes(t) {
  const m = t.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/);
  if (m) return MESES_BASE()[m[1] === "setiembre" ? "septiembre" : m[1]];
  if (/este mes/.test(t)) return new Date().getMonth() + 1;
  if (/(el )?mes que viene|proximo mes/.test(t)) return ((new Date().getMonth() + 1) % 12) + 1;
  return null;
}

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
const iso = (d) => d.toISOString().slice(0, 10);
// Corrige erratas en los meses ("diceimbre", "novienbre", "setiembre") comparando letra a letra
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const corrigeMeses = (t) =>
  t.replace(/\b[a-z]{4,11}\b/g, (w) => {
    if (NOMBRES_MES.includes(w) || w === "setiembre") return w;
    const max = w.length >= 7 ? 2 : 1;
    const m = NOMBRES_MES.find((n) => Math.abs(n.length - w.length) <= max && distancia(w, n) <= max);
    return m || w;
  });
const norm = (t) => corrigeMeses(t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
const fmt = (s) => new Date(s + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const eur = (n) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} €`;
const toNum = (w) => (/^\d+$/.test(w) ? Number(w) : NUM[w]);

function parseFechas(t, mesContexto) {
  const hoy = new Date();
  const year = (m, d) => (new Date(Date.UTC(hoy.getFullYear(), m - 1, d)) < hoy ? hoy.getFullYear() + 1 : hoy.getFullYear());
  // "del 18 al 20 de diciembre", "18 al 20 diciembre", "del 30 de noviembre al 2 de diciembre"
  let m = t.match(/(\d{1,2})\s*(?:de\s+(\w+)\s*)?(?:al|hasta el|-|a)\s*(\d{1,2})\s+(?:de\s+)?(\w+)/);
  if (m && MESES[m[4]]) {
    const m2 = MESES[m[4]], m1 = m[2] && MESES[m[2]] ? MESES[m[2]] : m2, y = year(m1, +m[1]);
    return { entrada: iso(new Date(Date.UTC(y, m1 - 1, +m[1]))), salida: iso(new Date(Date.UTC(m2 < m1 ? y + 1 : y, m2 - 1, +m[3]))) };
  }
  // "del 18 al 20" sin mes: el mes del que estábamos hablando, o el próximo en que caigan esas fechas
  m = t.match(/\bdel?\s+(\d{1,2})\s+(?:al|hasta el)\s+(\d{1,2})\b/);
  if (m && +m[1] <= 31 && +m[2] <= 31) {
    let mes = mesContexto || hoy.getMonth() + 1;
    if (!mesContexto && +m[1] <= hoy.getDate()) mes = (mes % 12) + 1;
    const y = year(mes, +m[1]);
    const mesSal = +m[2] < +m[1] ? (mes % 12) + 1 : mes;
    return { entrada: iso(new Date(Date.UTC(y, mes - 1, +m[1]))), salida: iso(new Date(Date.UTC(mesSal < mes ? y + 1 : y, mesSal - 1, +m[2]))) };
  }
  if (/fin de semana|finde/.test(t)) {
    const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
    let add = (5 - d.getUTCDay() + 7) % 7;
    if (/que viene|proximo|siguiente/.test(t)) add += 7;
    d.setUTCDate(d.getUTCDate() + add);
    const s = new Date(d);
    s.setUTCDate(s.getUTCDate() + 2);
    return { entrada: iso(d), salida: iso(s) };
  }
  m = t.match(/(\d{1,2})\s+de\s+(\w+)/);
  const n = t.match(/(\d+|\w+)\s+noches?/);
  if (m && MESES[m[2]]) {
    const d = new Date(Date.UTC(year(MESES[m[2]], +m[1]), MESES[m[2]] - 1, +m[1]));
    const s = new Date(d);
    s.setUTCDate(s.getUTCDate() + ((n && toNum(n[1])) || 2));
    return { entrada: iso(d), salida: iso(s) };
  }
  return null;
}

function parseHuespedes(t, st) {
  const N = "(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis)";
  const a = t.match(new RegExp(N + "\\s+(adultos?|personas?|mayores)"));
  const n = t.match(new RegExp(N + "\\s+(ninos?|ninas?|hij[oa]s?|peques?|crios?)"));
  const b = t.match(new RegExp(N + "\\s+(bebes?)"));
  if (a) st.adultos = toNum(a[1]);
  if (n) st.ninos = toNum(n[1]);
  if (b) st.bebes = toNum(b[1]);
  if (/sin (ninos|hijos|peques)|solo adultos|nosotros dos|mi pareja y yo|en pareja/.test(t)) {
    st.ninos = 0;
    if (!st.adultos) st.adultos = 2;
  }
  if (/sin (perro|mascota)|no (llevamos|traemos|vamos con) (perro|mascota)/.test(t)) st.mascota = false;
  else if (/(con|llevamos|traemos|y) (un |el |nuestro |mi )?(perro|perrete|mascota)/.test(t)) st.mascota = true;
}

// Respuestas basadas en la información interna del destino (conocimiento/cordoba.md)
function faq(t) {
  if (/que hay en el camping|instalaciones|servicios|que tiene el camping|que ofrece/.test(t))
    return "En el camping tienes piscina gratis en verano, restaurante y bar (cierra los martes), wifi en recepción, pistas de juego, un poblado para niños y parque infantil, y rutas de senderismo alrededor. Supermercado no hay, pero el bar tiene lo básico y llega Uber Eats. ¿Quieres saber algo más concreto?";
  if (/acampada|acampar|parcela|caravana|autocaravana|camper|furgo|mi (propia )?tienda|tienda propia|nuestra tienda/.test(t))
    return "Sí hay acampada en el camping, pero la gestiona directamente el Camping Los Villares, no Kampaoh. Para parcela, caravana o tu propia tienda tienes que contactar con ellos. Yo te puedo ayudar con nuestras tiendas ya montadas y equipadas.";
  if (/check.?in|hora de (entrada|llegada)|a que hora (se )?(llega|entra)/.test(t)) return "El check-in es entre las 16:00 y las 21:00, y el check-out hasta las 11:00.";
  if (/check.?out|hora de salida|a que hora (hay que )?(salir|irse)/.test(t)) return "El check-out es hasta las 11:00. El check-in, entre las 16:00 y las 21:00.";
  if (/aparca|parking|coche/.test(t)) return "Sí hay parking, fuera del recinto. Con el coche solo se puede entrar para descargar al llegar.";
  if (/donde|direccion|ubica|como (se )?llega|lejos|distancia|centro/.test(t))
    return "Estamos en el Parque Los Villares, carretera CO-3408 km 5,5, en la Sierra de Córdoba, a unos 20 minutos en coche del centro. No hay transporte público hasta el camping, así que mejor venir en coche.";
  if (/piscina|banar/.test(t)) return "Sí, la piscina es gratis y abre de 11:00 a 21:00, más o menos de mediados de mayo a finales de septiembre.";
  if (/perro|mascota/.test(t)) return "¡Sí! Hay tiendas que admiten mascotas, como la Bell XL, la Emperador o la Anza en su versión para mascotas. Si venís con perro, te enseño solo esas.";
  if (/barbacoa|bbq|fuego|brasa/.test(t)) return "Las barbacoas y el fuego están prohibidos todo el año. Lo que sí hay es una zona de planchas de gas en el restaurante: 10 € para toda la estancia, dejándolas limpias tras cada uso. El camping gas sí está permitido.";
  if (/plancha|cocinar/.test(t)) return "En el restaurante hay una zona de planchas de gas para los clientes: 10 € para toda la estancia, siempre que se dejen limpias. El camping gas también se permite; las barbacoas no.";
  if (/restaurante|comer|cenar|desayun|menu/.test(t))
    return "Hay restaurante abierto todo el año, aunque cierra los martes. En verano: de lunes a jueves de 12 a 16 con menús, viernes y sábado de 13 a 16 y de 20 a 23, y los domingos cierra. En invierno, entre semana solo desayunos y los fines de semana desayunos y almuerzos. Y llega Uber Eats al camping.";
  if (/super|tienda de comida|compra/.test(t)) return "No hay supermercado, pero en el bar tienen algunos productos básicos. También llega Uber Eats.";
  if (/wifi|internet/.test(t)) return "Hay wifi gratis, pero solo en la recepción.";
  if (/playa/.test(t)) return "Córdoba no tiene playa cerca; la más próxima está a unos 164 km. A cambio, tenemos piscina en verano y la sierra alrededor.";
  if (/ninos|crios|peques|infantil|familia/.test(t))
    return "Hay pistas de juego, un Poblado para niños abierto todo el año y un parque infantil en la entrada. Actividades organizadas para niños no hay, y eso depende del camping.";
  if (/bano|ducha|aseo/.test(t)) return "Varias tiendas tienen baño privado, como la Anza, la Bali, la Buka XL o las Tiny. Para el resto, los baños del camping están en el centro y quedan muy cerca de todas las tiendas, según nos indica el camping.";
  if (/senderismo|rutas|deporte|andar/.test(t)) return "Por la zona hay varias rutas de senderismo. Ten en cuenta que eso depende del camping y del entorno, no de Kampaoh.";
  if (/evento|feria|patios|festival|que hacer|planes/.test(t))
    return "En Córdoba tienes la Batalla de las Flores el 26 de abril, el Festival de los Patios del 4 al 17 de mayo, la Feria del 23 al 30 de mayo y el Guitar Fest del 1 al 11 de julio. Además, la Mezquita y el Puente Romano quedan a 20 minutos.";
  if (/factura/.test(t)) return "Las facturas de este destino se piden directamente al camping.";
  if (/cancel/.test(t)) return "Con la tarifa FLEX cancelas gratis hasta 48 horas antes de llegar; la tarifa SMART es algo más barata pero no reembolsable.";
  if (/precio|cuesta|cuanto|tarifa/.test(t) && !/\d/.test(t)) return "Depende de la tienda y las fechas. Dime cuándo venís y cuántos sois y te digo el precio exacto ahora mismo.";
  return null;
}

// Envoltorio: nunca repetir la misma respuesta dos veces seguidas
export async function demoReply(st, raw) {
  const r = await responder(st, raw);
  if (r.text === st.ultima && !r.events.length) {
    const sabe = [
      st.entrada && `fechas del ${fmt(st.entrada)} al ${fmt(st.salida)}`,
      st.adultos && `${st.adultos} adultos`,
      st.ninos !== undefined && (st.ninos ? `${st.ninos} niños` : "sin niños"),
      st.mascota && "con perro",
    ].filter(Boolean);
    r.text =
      "Perdona, eso no lo he pillado bien." +
      (sabe.length ? ` De momento tengo: ${lista(sabe)}.` : "") +
      (!st.entrada
        ? " ¿Me dices qué días te vienen bien, por ejemplo «del 13 al 15»? Si no tienes días fijos, dime «lo más barato» y te lo busco."
        : " ¿Quieres que te enseñe las tiendas libres, que cambiemos las fechas o tienes alguna duda del destino?");
  }
  st.ultima = r.text;
  return r;
}

// "la semana que viene", "esta semana", "dentro de dos semanas" → rango de entradas posibles (lunes a domingo)
function parseSemana(t) {
  const hoy = new Date();
  const lunes = (offsetSemanas) => {
    const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7 * offsetSemanas);
    return d;
  };
  let off = null;
  if (/(la )?semana que viene|(la )?proxima semana|la semana siguiente/.test(t)) off = 1;
  else if (/esta semana/.test(t)) off = 0;
  else if (/dentro de (dos|2) semanas|en (dos|2) semanas/.test(t)) off = 2;
  if (off === null) return null;
  const a = lunes(off), b = new Date(a);
  b.setUTCDate(b.getUTCDate() + 6);
  return { desde: iso(a), hasta: iso(b) };
}

async function responder(st, raw) {
  const t = norm(raw);
  const events = [];
  const say = (text) => ({ text, events });

  // Saludo en cualquier momento: saludar y retomar donde íbamos
  if (/^(hola|buenas|hey|buenos dias|buenas tardes)\b/.test(t.trim()) && t.trim().split(/\s+/).length <= 3) {
    if (st.entrada || st.adultos) return say("¡Hola de nuevo! ¿En qué más te puedo ayudar?");
    return say("¡Hola! ¿En qué te puedo ayudar? Pregúntame lo que quieras.");
  }

  // "La semana que viene": buscar la mejor opción dentro de esa semana
  const semana = !parseFechas(t) && parseSemana(t);
  if (semana) {
    parseHuespedes(t, st);
    st.prefs = leerPreferencias(raw, st.prefs || {});
    const nN = t.match(/(\d+|una|dos|tres|cuatro|cinco|seis)\s+noches?/);
    if (nN) st.noches = toNum(nN[1]);
    const r = await buscarFechasBaratas({ ...semana, noches: st.noches || 2, adultos: st.adultos || 2, ninos: st.ninos || 0, mascota: !!st.mascota, max: 4 });
    r.titulo = `semana del ${fmt(semana.desde)} al ${fmt(semana.hasta)}`;
    events.push({ type: "fechas_baratas", data: r });
    st.ultimaLista = r.mas_baratas;
    st.mes = Number(semana.desde.slice(5, 7));
    st.esperando = "elegir_fecha";
    st.paso = "fechas";
    delete st.entrada;
    if (!r.mas_baratas.length) return say(`Vaya, esa semana no nos queda sitio. ¿Miramos la siguiente?`);
    const b = r.mas_baratas[0];
    return say(
      `¡Buena idea! La semana del ${fmt(semana.desde)} hay sitio. Lo más económico es entrar el ${fmt(b.entrada)} y salir el ${fmt(b.salida)}, desde ${eur(b.total)} las ${b.noches} noches.` +
        (st.adultos ? "" : " Lo he calculado para 2 adultos.") +
        " ¿Qué días te encajan? Pulsa una opción o dime los días."
    );
  }
  st.paso ||= "inicio";

  // Elegir tienda tras ver la disponibilidad
  if (st.paso === "elegir" && st.disp) {
    const libres = st.disp.opciones.filter((o) => o.disponible);
    const pick = raw.match(/con la (.+)$/i);
    let elegida = pick && libres.find((o) => norm(pick[1]).includes(norm(o.nombre)));
    elegida ||= libres.find((o) => norm(o.nombre).split(" ").some((w) => w.length > 3 && w !== "tienda" && w !== "privado" && t.includes(w)));
    if (!elegida && /^(si|vale|esa|ok|perfecto|la que recomiendas)/.test(t)) elegida = st.recomendada;
    if (!elegida && /^(no|ninguna|ninguno)\b/.test(t.trim()))
      return say("Sin problema. Pulsa «Elegir» en la que más te guste, dime qué buscas (más barata, con baño, más grande…) o probamos otras fechas.");
    if (elegida) {
      const tarifa = /no reembolsable|smart/.test(t) ? "SMART" : /flex|cancelable|cancelacion gratis|reembolsable/.test(t) ? "FLEX" : undefined;
      let r;
      try {
        r = await prepararReserva({ ...st, alojamiento_id: elegida.id, tarifa });
      } catch (e) {
        return say(`Vaya, la ${elegida.nombre} se acaba de quedar sin hueco en esas fechas. ¿Te enseño otra opción?`);
      }
      events.push({ type: "preparar_reserva", data: r });
      st.paso = "hecho";
      const otra = r.otras_tarifas?.[0];
      const aviso = r.tarifa_pedida_no_disponible
        ? ` Para esta tienda y fechas solo queda la opción ${r.no_reembolsable ? "no reembolsable" : "con cancelación gratis"}.`
        : otra
          ? otra.tarifa === "SMART"
            ? ` Es con cancelación gratis hasta 48 horas antes. Si prefieres ahorrar, sin posibilidad de reembolso sale por ${eur(otra.total)}.`
            : ` Es la opción no reembolsable. Por ${eur(otra.total)} la tienes con cancelación gratis hasta 48 horas antes.`
          : "";
      return say(
        `¡Perfecto! ${r.alojamiento}, ${eur(r.total)} en total.${aviso} Y si eres de Kampaoh Tribe, al iniciar sesión en el pago te queda desde ${eur(r.total_tribe)}. Pulsa «Reservar y pagar aquí» y terminas la reserva sin salir del chat: solo tus datos y el pago.`
      );
    }
  }

  const fechas = parseFechas(t, st.mes);
  const antes = JSON.stringify([st.adultos, st.ninos, st.bebes, st.mascota]);
  parseHuespedes(t, st);
  // Respuestas cortas a la última pregunta ("no", "sí", "dos", "3"…)
  const solo = t.trim().replace(/[.!¡¿?,]/g, "").match(/^(\d+|un|uno|una|dos|tres|cuatro|cinco|seis)$/);
  const negativo = /^(no|nop|nope|ninguno|ninguna|nada|sin ninos|solo adultos|no venimos con ninos)\b/.test(t.trim());
  if (st.esperando === "adultos" && solo && st.adultos === undefined) st.adultos = toNum(solo[1]);
  if (st.esperando === "ninos") {
    if (negativo) {
      st.ninos ??= 0;
      if (!/perro|mascota/.test(t)) st.mascota ??= false;
    } else if (solo) st.ninos = toNum(solo[1]);
    else if (/^(si|sí|claro|vale)\b/.test(t) && st.ninos === undefined) {
      st.esperando = "cuantos_ninos";
      return say("¡Genial! ¿Cuántos peques venís?");
    }
  }
  if (st.esperando === "cuantos_ninos" && solo) st.ninos = toNum(solo[1]);

  // Mes sin días concretos ("en noviembre") y búsqueda de las fechas más baratas
  const mes = !fechas && parseMes(t);
  if (mes) { st.mes = mes; delete st.entrada; }
  const nN = t.match(/(\d+|una|dos|tres|cuatro|cinco|seis|siete)\s+noches?/);
  if (nN) st.noches = toNum(nN[1]) || { siete: 7 }[nN[1]];
  const quiereBarato = /barat|economic|mejor precio|menos dinero|mas asequible|me da igual|cualquier(a)? (dia|fecha)|cuando sea/.test(t);
  if (!fechas && !st.entrada && (quiereBarato || (st.mes && st.esperando === "mes_dias" && /^(si|vale|ok|venga|dale)/.test(t)))) {
    const finde = /fin(es)? de semana|finde/.test(t);
    // Sin mes: el resto de este mes + el siguiente
    const hoyMes = new Date().getMonth() + 1;
    const meses = st.mes ? [st.mes] : [hoyMes, (hoyMes % 12) + 1];
    const base = { noches: st.noches || 2, adultos: st.adultos || 2, ninos: st.ninos || 0, mascota: !!st.mascota, solo_fines_de_semana: finde, max: 3 };
    const partes = await Promise.all(meses.map((mes) => buscarFechasBaratas({ ...base, mes })));
    const r = { ...partes[0], mas_baratas: partes.flatMap((p) => p.mas_baratas).sort((a, b) => a.total - b.total || a.entrada.localeCompare(b.entrada)).slice(0, 3) };
    if (meses.length > 1) r.titulo = `próximas semanas (${NOMBRE_MES[meses[0]]} y ${NOMBRE_MES[meses[1]]})`;
    st.mes = Number(r.mas_baratas[0]?.entrada.slice(5, 7)) || meses[0];
    events.push({ type: "fechas_baratas", data: r });
    st.ultimaLista = r.mas_baratas;
    st.esperando = "elegir_fecha";
    st.paso = "fechas";
    const donde = meses.length > 1 ? `${NOMBRE_MES[meses[0]]} y ${NOMBRE_MES[meses[1]]}` : `todo ${NOMBRE_MES[meses[0]]}`;
    if (!r.mas_baratas.length) return say(`Vaya, en ${donde} no queda sitio${finde ? " en fin de semana" : ""}. ¿Miramos otro mes?`);
    const b = r.mas_baratas[0];
    const supuestos = st.adultos ? "" : " Lo he calculado para 2 adultos; si sois más, dímelo.";
    return say(
      `He mirado ${donde}${finde ? " en fin de semana" : ""}. Lo más barato son ${b.noches} noches desde ${eur(b.total)}, entrando el ${fmt(b.entrada)}` +
        (r.mas_baratas.length > 1 ? `; también tienes el ${r.mas_baratas.slice(1).map((x) => fmt(x.entrada)).join(" y el ")} al mismo precio o parecido` : "") +
        `.${supuestos} ¿Qué fecha te viene mejor?`
    );
  }
  if (mes && !quiereBarato && !/tienda|alojamiento|recomiend|aire|bano|perro|ninos|pareja/.test(t)) {
    st.esperando = "mes_dias";
    st.paso = "fechas";
    return say(`¡${NOMBRE_MES[mes][0].toUpperCase() + NOMBRE_MES[mes].slice(1)} es buena época! ¿Tienes días concretos o te busco las fechas más baratas del mes?`);
  }
  const datosNuevos = antes !== JSON.stringify([st.adultos, st.ninos, st.bebes, st.mascota]);
  if (fechas) { Object.assign(st, fechas); st.mes = Number(fechas.entrada.slice(5, 7)); }

  // Respuesta corta tras ver la lista de fechas baratas: "la primera", "el 22"
  if (st.esperando === "elegir_fecha" && !fechas && st.mes) {
    const dia = t.match(/\b(?:el )?(\d{1,2})\b/);
    const ord = { primera: 0, primero: 0, segunda: 1, segundo: 1, tercera: 2, tercero: 2 }[(t.match(/primer[ao]?|segund[ao]|tercer[ao]?/) || [])[0]];
    if (dia || ord !== undefined) {
      const y = new Date().getMonth() + 1 > st.mes ? new Date().getFullYear() + 1 : new Date().getFullYear();
      const d = new Date(Date.UTC(y, st.mes - 1, dia ? +dia[1] : 1));
      if (ord !== undefined && st.ultimaLista?.[ord]) Object.assign(st, { entrada: st.ultimaLista[ord].entrada, salida: st.ultimaLista[ord].salida });
      else if (dia) {
        const s = new Date(d);
        s.setUTCDate(s.getUTCDate() + (st.noches || 2));
        Object.assign(st, { entrada: iso(d), salida: iso(s) });
      }
    }
  }

  // Preferencias (niños, perro, baño, pareja, presupuesto…) que se van acumulando
  st.prefs = leerPreferencias(raw, st.prefs || {});
  if (st.prefs.mascota === true) st.mascota ??= true;
  if (st.prefs.mascota === false) st.mascota = false;

  // "¿Qué tienda es mejor para…?" → recomendación con los datos reales de cada tienda
  // "¿Cómo son las tiendas?" → resumen de los tipos con fotos
  if (/como son las tiendas|que tiendas (hay|teneis|tienes)|tipos de (tienda|alojamiento)|que alojamientos|ensename las tiendas/.test(t)) {
    const dest = await getDestino();
    const vistas = new Set();
    const tiendas = dest.tiendas.filter((x) => {
      const base = x.nombre.replace(/\s*\(admite mascotas\)/, "").replace(/ con aire acondicionado/, "");
      if (vistas.has(base)) return false;
      vistas.add(base);
      return true;
    }).sort((a, b) => (a.capacidad || 0) - (b.capacidad || 0));
    events.push({
      type: "recomendacion",
      data: {
        titulo: `Las ${tiendas.length} tiendas de Kampaoh Córdoba`,
        tiendas: tiendas.map((x) => ({ ...x, por: [x.bano_privado ? "baño privado" : "baños del camping", x.mascotas || dest.tiendas.some((y) => y.mascotas && y.nombre.startsWith(x.nombre)) ? "versión con perro" : null].filter(Boolean) })),
      },
    });
    return say(
      "Todas vienen montadas y equipadas, con camas hechas y luz: solo tienes que llegar. Las hay para dos, como la Bell o la Tiny Love; para familias, como la Tiny Play o la Bell XL; y grandes, como la Bali o la Emperador. Varias tienen baño privado y algunas admiten perro. Toca una foto para verla por dentro. ¿Vienes en pareja, con niños o en grupo?"
    );
  }

  const pideConsejo =
    (/(que|cual|cuales|mejor|mejores|recomiend|ideal|aconsej|sugier|opciones|buena)\b.*\b(tiendas?|alojamientos?|opcion|para|con)\b|\btiendas?\b.*\b(para|con|que)\b/.test(t) ||
      /^(queremos|quiero|buscamos|busco|nos gustaria|me gustaria|necesitamos|necesito)\b|\balgo (con|para|que)\b/.test(t)) &&
    !/acampada|parcela|caravana/.test(t);
  if (pideConsejo && hayPreferencias(st.prefs) && !fechas && st.paso !== "elegir") {
    const dest = await getDestino();
    const recs = recomendar(dest.tiendas, st.prefs, { personas: (st.adultos || 0) + (st.ninos || 0) });
    if (!recs.length) return say("Con lo que me cuentas no tengo una tienda que encaje del todo. ¿Me das algo más de detalle?");
    const [a, ...rest] = recs;
    events.push({ type: "recomendacion", data: { titulo: `Mejores tiendas para ${describirPreferencias(st.prefs)}`, tiendas: recs } });
    return say(
      `Para ${describirPreferencias(st.prefs)} te recomiendo la ${a.nombre}: ${lista(a.por.slice(0, 3))}.` +
        (rest.length ? ` También encajan ${lista(rest.map((x) => `la ${x.nombre}`))}.` : "") +
        ` ¿Te miro precio y disponibilidad para unas fechas?`
    );
  }

  const r = faq(t);
  if (r && !fechas && !datosNuevos && !/reserv/.test(t)) return say(r);

  if (/^(hola|buenas|hey)/.test(t) && !fechas && !st.adultos) {
    return say("¡Hola! ¿En qué te puedo ayudar? Pregúntame lo que quieras.");
  }

  if (/reserv|disponib|hueco|libre|quiero ir|escapada|buscar/.test(t) || fechas || st.paso !== "inicio") {
    st.paso = "fechas";
    if (!st.entrada) return say("¡Genial! ¿Qué días queréis venir? Por ejemplo: del 12 al 14 de diciembre, o el finde que viene.");
    if (!st.adultos) {
      st.esperando = "adultos";
      return say(`Del ${fmt(st.entrada)} al ${fmt(st.salida)}, apuntado. ¿Cuántos adultos seríais?`);
    }
    if (st.ninos === undefined) {
      if (st.esperando === "ninos") {
        // Ya lo preguntamos y no lo ha dicho: seguimos sin atascarnos y lo dejamos claro
        st.ninos = 0;
        st.ninosAsumido = true;
      } else {
        st.esperando = "ninos";
        return say(`${st.adultos} adultos, perfecto. ¿Viene algún niño o bebé? Y si traéis perro, dímelo también.`);
      }
    }
    st.esperando = null;
    st.mascota ??= false;

    let disp;
    try {
      disp = await consultarDisponibilidad(st);
    } catch (e) {
      return say("Ahora mismo no puedo consultar la disponibilidad. Prueba en un momento o reserva directamente en booking.kampaoh.com.");
    }
    st.disp = disp;
    events.push({ type: "consultar_disponibilidad", data: disp });
    const libres = disp.opciones.filter((o) => o.disponible);
    if (!libres.length) {
      delete st.entrada;
      return say(`Vaya, para esas fechas no queda sitio para ${st.adultos + st.ninos} personas${st.mascota ? " con mascota" : ""}. ¿Probamos otras fechas?`);
    }
    // Recomendación con preferencias + precios reales de esas fechas
    const dest = await getDestino();
    const precios = Object.fromEntries(libres.map((o) => [o.id, o.desde]));
    const prefs = { ...st.prefs, ninos: st.prefs?.ninos || st.ninos > 0 || st.bebes > 0 };
    const recs = recomendar(dest.tiendas, prefs, { personas: st.adultos + st.ninos, precios, max: 2 });
    const rec = recs[0] && libres.find((o) => o.id === recs[0].roomTypeId);
    st.recomendada = rec || libres[0];
    st.paso = "elegir";
    const barata = libres[0];
    const porque = recs[0]?.por.length ? `: ${lista(recs[0].por.slice(0, 2))}` : "";
    const quien = `${st.adultos} adultos${st.ninos ? ` y ${st.ninos} ${st.ninos === 1 ? "niño" : "niños"}` : ""}${st.mascota ? " con perro" : st.mascota === false && /perro/.test(t) ? " sin perro" : ""}`;
    const nota = st.ninosAsumido ? " (si viene algún niño, dímelo y lo recalculo)" : "";
    st.ninosAsumido = false;
    return say(
      `Del ${fmt(st.entrada)} al ${fmt(st.salida)} para ${quien}${nota}: ¡hay sitio! Tengo ${libres.length} opciones, desde ${eur(barata.desde)} la ${barata.nombre}. ` +
        (st.recomendada !== barata || porque ? `Para vosotros os recomiendo la ${st.recomendada.nombre}, desde ${eur(st.recomendada.desde)}${porque}. ` : "") +
        "¿Cuál os gusta?"
    );
  }

  return say("En modo demo entiendo preguntas sobre el destino (horarios, piscina, parking, mascotas, restaurante…) y búsquedas de fechas. Prueba con: «Quiero reservar del 12 al 14 de diciembre para dos adultos».");
}
