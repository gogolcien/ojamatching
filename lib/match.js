// Normaliza un nombre para compararlo sin importar acentos, mayúsculas
// o espacios de más (usado al agregar/renombrar jugadores).
export function normalize(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
