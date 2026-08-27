/* ==================================================================
   Eliminación directa — lógica pura (sin tocar la base de datos).

   Reglas:
   - Ronda 1: pareo aleatorio. Si el número de jugadores es impar, uno
     al azar recibe AUTOWIN (bye_win) y avanza directo.
   - Cada mesa (excepto los AUTOWIN) admite solo 3 resultados:
     'a_win' | 'b_win' | 'double_loss'.
   - Quien pierde queda eliminado. Quien gana avanza al cruce que le
     corresponde en la siguiente ronda, según su posición fija en el
     bracket (slot_index).
   - 'double_loss': ambos jugadores de esa mesa quedan eliminados. El
     rival que le tocaba enfrentar al ganador de esa mesa en la
     siguiente ronda pasa automáticamente con AUTOWIN.
   - El organizador puede reacomodar manualmente los cruces de
     cualquier ronda antes de capturar resultados (igual que el pareo
     manual del formato suizo).
   ================================================================== */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Orden de siembra clásico de brackets de eliminación directa. Para
// un tamaño de N (potencia de 2), devuelve un arreglo de N números de
// semilla en el orden en que deben acomodarse en la Ronda 1: las
// posiciones consecutivas de a pares (0-1, 2-3, 4-5...) forman cada
// mesa. Esto garantiza que los mejores semilleros se enfrenten entre
// sí lo más tarde posible: 1 vs 2 solo hasta la Final, 1-4 en
// cuartos/semifinales distintas, 1-8 en octavos/cuartos distintos, y
// así sucesivamente.
// Ej. seedOrder(8) = [1, 8, 4, 5, 2, 7, 3, 6]
//   Mesa 1: 1v8   Mesa 2: 4v5   Mesa 3: 2v7   Mesa 4: 3v6
function seedOrder(size) {
  if (size <= 1) return [1];
  const prev = seedOrder(size / 2);
  const out = [];
  prev.forEach((s) => out.push(s, size + 1 - s));
  return out;
}

// A partir de standings ya ordenados (mejor a peor) y un tamaño de
// corte (4, 8, 16, 32, 64...), arma las mesas de la Ronda 1 de un Top
// Cut, sembradas con el criterio estándar de seedOrder. `cutSize`
// debe ser una potencia de 2 y no mayor a orderedPlayers.length.
function seedTopCutFirstRound(orderedPlayers, cutSize) {
  const players = orderedPlayers.slice(0, cutSize);
  const order = seedOrder(cutSize);
  const bySeed = order.map((seedNum) => players[seedNum - 1]);
  const pairs = [];
  let slot = 0;
  for (let i = 0; i < bySeed.length; i += 2) {
    pairs.push({ slotIndex: slot++, playerAId: bySeed[i].id, playerBId: bySeed[i + 1].id });
  }
  return pairs;
}

// Ronda 1: arma las mesas al azar. slotIndex 0..n-1 en el orden en
// que se van a jugar; si sobra un jugador, recibe AUTOWIN.
// Devuelve [{ slotIndex, playerAId, playerBId }] (playerBId null = AUTOWIN).
function generateFirstRound(players) {
  const shuffled = shuffle(players);
  const pairs = [];
  let slot = 0;
  while (shuffled.length >= 2) {
    const a = shuffled.shift();
    const b = shuffled.shift();
    pairs.push({ slotIndex: slot++, playerAId: a.id, playerBId: b.id });
  }
  if (shuffled.length === 1) {
    pairs.push({ slotIndex: slot++, playerAId: shuffled[0].id, playerBId: null });
  }
  return pairs;
}

// A partir de las mesas ya jugadas de una ronda (con resultado),
// calcula quién ganó cada una. Devuelve un mapa slotIndex -> playerId
// ganador, o null si esa mesa terminó en 'double_loss' (nadie avanza).
function winnersBySlot(matches) {
  const map = {};
  matches.forEach((m) => {
    if (m.playerBId == null) {
      map[m.slotIndex] = m.result === "bye_loss" ? null : m.playerAId;
      return;
    }
    if (m.result === "a_win") map[m.slotIndex] = m.playerAId;
    else if (m.result === "b_win") map[m.slotIndex] = m.playerBId;
    else map[m.slotIndex] = null; // double_loss, o pendiente
  });
  return map;
}

// True si a todas las mesas de la ronda ya se les capturó resultado.
function isRoundComplete(matches) {
  return matches.every((m) => m.result != null);
}

// A partir de las mesas ya jugadas de una ronda, calcula quién PERDIÓ
// cada una (para armar el partido por 3er lugar entre los dos
// perdedores de la semifinal). Ignora AUTOWIN (no hay perdedor real)
// y 'double_loss' (ambos ya quedaron eliminados, no hay a quién mandar
// a la mesa de 3er lugar desde esa semifinal).
function losersBySlot(matches) {
  const map = {};
  matches.forEach((m) => {
    if (m.playerBId == null) return;
    if (m.result === "a_win") map[m.slotIndex] = m.playerBId;
    else if (m.result === "b_win") map[m.slotIndex] = m.playerAId;
  });
  return map;
}

// Arma las mesas de la siguiente ronda combinando los ganadores de
// mesas consecutivas (slot 0 y 1 -> nueva mesa 0, slot 2 y 3 -> nueva
// mesa 1, etc). Si de un cruce solo sobrevive un jugador (por
// double_loss del otro), ese jugador avanza directo con AUTOWIN.
// Devuelve { pairs, championId }:
//   - pairs: [{ slotIndex, playerAId, playerBId }] para la nueva ronda
//   - championId: id del ganador del torneo, si esta ronda ya lo decidió
function generateNextRound(lastRoundMatches) {
  // Guarda de seguridad: si esta ronda ya es la Final (con o sin
  // partido de 3er lugar incluido), es TERMINAL — nunca se debe
  // generar una ronda siguiente a partir de ella. Se determina el
  // campeón directamente de la mesa que NO es de 3er lugar.
  if (lastRoundMatches.some((m) => m.isThirdPlace)) {
    const finalMatch = lastRoundMatches.find((m) => !m.isThirdPlace);
    let championId = null;
    if (finalMatch && finalMatch.result) {
      if (finalMatch.playerBId == null) championId = finalMatch.playerAId;
      else if (finalMatch.result === "a_win") championId = finalMatch.playerAId;
      else if (finalMatch.result === "b_win") championId = finalMatch.playerBId;
    }
    return { pairs: [], championId };
  }

  const winners = winnersBySlot(lastRoundMatches);
  const maxSlot = Math.max(...lastRoundMatches.map((m) => m.slotIndex));
  const ordered = [];
  for (let i = 0; i <= maxSlot; i++) ordered.push(winners[i] ?? null);

  if (ordered.length === 1) {
    return { pairs: [], championId: ordered[0] || null };
  }

  const pairs = [];
  let slot = 0;
  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1] ?? null;
    if (a == null && b == null) continue; // los dos cruces se cayeron por double_loss
    if (a != null && b != null) {
      pairs.push({ slotIndex: slot++, playerAId: a, playerBId: b });
    } else {
      // uno de los dos cruces anteriores quedó vacío: el sobreviviente
      // pasa directo con AUTOWIN.
      pairs.push({ slotIndex: slot++, playerAId: a ?? b, playerBId: null });
    }
  }

  if (pairs.length === 1 && pairs[0].playerBId == null) {
    return { pairs: [], championId: pairs[0].playerAId };
  }

  // Si la nueva ronda va a ser la FINAL (un solo cruce con dos
  // jugadores reales) y la ronda que se acaba de jugar tenía
  // exactamente 2 mesas (era la semifinal), se agrega automáticamente
  // el partido por el 3er lugar entre los dos perdedores de esa
  // semifinal, como una segunda mesa dentro de esta misma ronda final.
  if (pairs.length === 1 && pairs[0].playerBId != null && lastRoundMatches.length === 2) {
    const losers = losersBySlot(lastRoundMatches);
    const loserIds = [losers[0], losers[1]].filter((id) => id != null);
    if (loserIds.length === 2) {
      pairs.push({ slotIndex: slot++, playerAId: loserIds[0], playerBId: loserIds[1], isThirdPlace: true });
    }
  }

  return { pairs, championId: null };
}

// Standings simples para eliminación directa: primero los jugadores
// que siguen en pie (no han perdido ninguna mesa), luego los
// eliminados ordenados por la ronda en que cayeron (más lejos que
// llegaron = mejor posición). Útil para "Copiar nombres en orden de
// posición" y para la pestaña Standings.
function computeEliminationStandings(players, rounds) {
  const eliminatedInRound = {};
  rounds.forEach((round) => {
    round.matches.forEach((m) => {
      if (!m.result) return;
      if (m.playerBId == null) return; // AUTOWIN no elimina a nadie
      if (m.result === "a_win") eliminatedInRound[m.playerBId] = round.roundNumber;
      else if (m.result === "b_win") eliminatedInRound[m.playerAId] = round.roundNumber;
      else if (m.result === "double_loss") {
        eliminatedInRound[m.playerAId] = round.roundNumber;
        eliminatedInRound[m.playerBId] = round.roundNumber;
      }
    });
  });

  const rows = players.map((p) => ({
    id: p.id,
    name: p.name,
    eliminatedInRound: eliminatedInRound[p.id] ?? null, // null = sigue en pie o es el campeón
  }));

  rows.sort((a, b) => {
    if (a.eliminatedInRound == null && b.eliminatedInRound == null) return a.name.localeCompare(b.name);
    if (a.eliminatedInRound == null) return -1;
    if (b.eliminatedInRound == null) return 1;
    return b.eliminatedInRound - a.eliminatedInRound || a.name.localeCompare(b.name);
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export {
  generateFirstRound,
  generateNextRound,
  isRoundComplete,
  computeEliminationStandings,
  seedOrder,
  seedTopCutFirstRound,
};
