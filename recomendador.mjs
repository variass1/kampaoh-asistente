// Recomendador de tiendas: entiende preferencias del cliente y puntúa cada tienda con sus datos reales
// (capacidad, m², baño, mascotas, aire acondicionado, descripción). Lo usan el modo demo y la IA.

const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Acumula preferencias a lo largo de la conversación
export function leerPreferencias(texto, prefs = {}) {
  const t = norm(texto);
  if (/\b(ninos?|ninas?|hij[oa]s?|peques?|familia|crios?|bebes?|chiquillos)\b/.test(t)) prefs.ninos = true;
  if (/\b(perros?|perrete|mascotas?|gatos?)\b/.test(t) && !/sin (perro|mascota)/.test(t)) prefs.mascota = true;
  if (/sin (perro|mascota)/.test(t)) prefs.mascota = false;
  if (/bano|ducha|aseo|vater|wc/.test(t) && !/banera/.test(t)) prefs.bano = true;
  if (/pareja|romantic|aniversario|luna de miel|nosotros dos|mi novi[oa]|mi mujer|mi marido/.test(t)) prefs.pareja = true;
  if (/barat|economic|presupuesto|ahorrar|low cost|asequible|lo justo/.test(t)) prefs.barato = true;
  if (/lujo|especial|premium|comod|amplia|espacios|grande|suite|capricho|mimarnos/.test(t)) prefs.confort = true;
  if (/calor|aire acondicionado|\baire\b|fresquito|julio|agosto/.test(t)) prefs.aire = true;
  if (/banera|spa|relax|desconectar/.test(t)) prefs.spa = true;
  if (/grupo|amigos|amigas/.test(t)) prefs.grupo = true;
  return prefs;
}

export const hayPreferencias = (p) => Object.entries(p).some(([k, v]) => v === true);

// Puntúa y explica. `precios` opcional: { [roomTypeId]: total } para tener en cuenta el presupuesto.
export function recomendar(tiendas, prefs = {}, { personas = 0, precios = null, max = 3 } = {}) {
  // Requisitos imprescindibles: si alguna tienda los cumple, solo esas
  const imprescindibles = [
    [prefs.aire, (t) => t.aire_acondicionado],
    [prefs.spa, (t) => /banera/i.test(norm(t.descripcion))],
  ];
  for (const [activo, ok] of imprescindibles) if (activo && tiendas.some(ok)) tiendas = tiendas.filter(ok);
  const lista = tiendas
    .filter((t) => !personas || (t.capacidad ?? 99) >= personas)
    .filter((t) => (prefs.mascota ? t.mascotas : true))
    .filter((t) => (precios ? precios[t.roomTypeId] != null : true))
    .map((t) => {
      const d = norm(t.descripcion + " " + t.nombre);
      let s = 0;
      const por = [];
      if (prefs.ninos) {
        if (/familia/.test(d)) (s += 4), por.push("pensada para familias");
        if ((t.capacidad || 0) >= 4) (s += 2), por.push(`caben hasta ${t.capacidad}`);
        if (t.bano_privado) (s += 2), por.push("baño privado, muy cómodo con peques");
        if ((t.capacidad || 0) <= 2) s -= 5;
      }
      if (prefs.mascota) {
        s += 1;
        por.push("admite perros");
        if (t.bano_privado) (s += 1), por.push("baño privado");
        if ((t.capacidad || 0) >= 4) por.push(`hasta ${t.capacidad} personas`);
      }
      // Sin perro, mejor la versión sin mascotas (alergias)
      if (prefs.mascota !== true && t.mascotas) s -= 0.5;
      if (prefs.bano && t.bano_privado) (s += 4), por.push("baño privado");
      if (prefs.bano && !t.bano_privado) s -= 3;
      if (prefs.pareja) {
        if ((t.capacidad || 0) <= 2) (s += 3), por.push("ideal para dos");
        if (/pareja|intim|romant/.test(d)) (s += 3), por.push("pensada para parejas");
      }
      if (prefs.spa && /banera/.test(d)) (s += 6), por.push(/exterior/.test(d) ? "bañera exterior privada" : "bañera con vistas a la naturaleza");
      if (prefs.ninos && /tobogan/.test(d)) (s += 2), por.push("tiene un tobogán que encanta a los peques");
      if (prefs.aire && t.aire_acondicionado) (s += 4), por.push("aire acondicionado");
      if (prefs.confort) {
        s += (t.m2 || 0) / 6;
        if (/suite|lujo|premium/.test(d)) (s += 2), por.push("de las más especiales");
        if (t.bano_privado) s += 1;
      }
      if (prefs.grupo && (t.capacidad || 0) >= 5) (s += 4), por.push(`para grupos de hasta ${t.capacidad}`);
      return { ...t, score: s, por: [...new Set(por)], total: precios?.[t.roomTypeId] ?? null };
    });

  // Presupuesto: si hay precios, el más barato suma; si no, preferimos tiendas sin baño (más económicas)
  if (prefs.barato) {
    const conPrecio = lista.filter((x) => x.total != null).sort((a, b) => a.total - b.total);
    conPrecio.forEach((x, i) => {
      x.score += Math.max(0, 5 - i * 1.5);
      if (i === 0) x.por.unshift("la más económica");
    });
    if (!conPrecio.length) lista.forEach((x) => { if (!x.bano_privado) x.score += 2; });
  }
  // Sin preferencias claras con precio: ligera ventaja al buen equilibrio
  if (precios && !hayPreferencias(prefs)) {
    const ord = [...lista].sort((a, b) => a.total - b.total);
    ord.forEach((x, i) => { x.score += (x.bano_privado ? 1.5 : 0) + Math.max(0, 2 - i * 0.5); });
  }
  // Evitar dos versiones de la misma tienda (con y sin mascotas): nos quedamos con la mejor
  const vistos = new Set();
  return lista
    .sort((a, b) => b.score - a.score || (a.total ?? 0) - (b.total ?? 0))
    .filter((x) => {
      const base = x.nombre.replace(/\s*\(admite mascotas\)/, "").replace(/ con aire acondicionado/, "");
      if (vistos.has(base)) return false;
      vistos.add(base);
      return true;
    })
    .slice(0, max);
}

export function describirPreferencias(p) {
  const partes = [];
  if (p.ninos) partes.push("venir con niños");
  if (p.mascota) partes.push("traer perro");
  if (p.bano) partes.push("baño privado");
  if (p.pareja) partes.push("una escapada en pareja");
  if (p.spa) partes.push("relax con bañera");
  if (p.aire) partes.push("aire acondicionado");
  if (p.confort) partes.push("algo especial y amplio");
  if (p.grupo) partes.push("ir en grupo");
  if (p.barato) partes.push("ajustar el precio");
  return partes.length > 1 ? partes.slice(0, -1).join(", ") + " y " + partes.at(-1) : partes[0] || "";
}
