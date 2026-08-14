// Funciones de acceso a datos sobre SQLite local. Cada función abre
// (o reutiliza) la conexión y hace exactamente una operación.
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";
import { getDb } from "./db";

/* ---------------- Torneos ---------------- */

export async function listTournaments() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM tournaments ORDER BY created_at DESC`
  );
}

export async function getTournament(id) {
  const db = await getDb();
  return db.getFirstAsync(`SELECT * FROM tournaments WHERE id = ?`, [id]);
}

export async function createTournament({ name, date, format }) {
  const db = await getDb();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO tournaments (id, name, date, format, status, created_at) VALUES (?, ?, ?, ?, 'ongoing', ?)`,
    [id, name.trim(), date, format, new Date().toISOString()]
  );
  return id;
}

export async function setTournamentStatus(id, status) {
  const db = await getDb();
  await db.runAsync(`UPDATE tournaments SET status = ? WHERE id = ?`, [status, id]);
}

export async function deleteTournament(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM tournaments WHERE id = ?`, [id]);
}

/* ---------------- Jugadores ---------------- */

export async function listPlayers(tournamentId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM players WHERE tournament_id = ? ORDER BY sort_order ASC`,
    [tournamentId]
  );
}

export async function addPlayer(tournamentId, name, deck = null) {
  const db = await getDb();
  const id = uuid();
  const row = await db.getFirstAsync(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM players WHERE tournament_id = ?`,
    [tournamentId]
  );
  await db.runAsync(
    `INSERT INTO players (id, tournament_id, name, deck, enabled, eliminated, sort_order) VALUES (?, ?, ?, ?, 1, 0, ?)`,
    [id, tournamentId, name.trim(), deck, row.next]
  );
  return id;
}

export async function renamePlayer(id, name) {
  const db = await getDb();
  await db.runAsync(`UPDATE players SET name = ? WHERE id = ?`, [name.trim(), id]);
}

export async function updatePlayerDeck(id, deck) {
  const db = await getDb();
  const value = deck && deck.trim() ? deck.trim() : null;
  await db.runAsync(`UPDATE players SET deck = ? WHERE id = ?`, [value, id]);
}

// roundNumber: ronda "actual" del torneo en el momento de inhabilitar
// (se guarda para poder mostrarla luego en standings). Al rehabilitar
// se limpia.
export async function togglePlayerEnabled(id, enabled, roundNumber = null) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE players SET enabled = ?, disabled_round = ? WHERE id = ?`,
    [enabled ? 1 : 0, enabled ? null : roundNumber, id]
  );
}

export async function deletePlayer(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM players WHERE id = ?`, [id]);
}

/* ---------------- Rondas y mesas ---------------- */

export async function listRounds(tournamentId) {
  const db = await getDb();
  const rounds = await db.getAllAsync(
    `SELECT * FROM rounds WHERE tournament_id = ? ORDER BY round_number ASC`,
    [tournamentId]
  );
  const all = await Promise.all(
    rounds.map(async (r) => ({
      id: r.id,
      roundNumber: r.round_number,
      matches: (
        await db.getAllAsync(
          `SELECT id, table_num AS tableNum, slot_index AS slotIndex, player_a_id AS playerAId, player_b_id AS playerBId, result
           FROM matches WHERE round_id = ? ORDER BY table_num ASC`,
          [r.id]
        )
      ),
    }))
  );
  return all;
}

// pairs: [{ slotIndex, playerAId, playerBId }] (playerBId null = AUTOWIN)
export async function createRound(tournamentId, roundNumber, pairs) {
  const db = await getDb();
  const roundId = uuid();
  await db.runAsync(
    `INSERT INTO rounds (id, tournament_id, round_number) VALUES (?, ?, ?)`,
    [roundId, tournamentId, roundNumber]
  );
  let table = 1;
  for (const p of pairs) {
    const result = p.playerBId == null ? "bye_win" : null;
    await db.runAsync(
      `INSERT INTO matches (id, round_id, table_num, slot_index, player_a_id, player_b_id, result)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), roundId, table++, p.slotIndex ?? null, p.playerAId, p.playerBId, result]
    );
  }
  return roundId;
}

export async function setMatchResult(matchId, result) {
  const db = await getDb();
  await db.runAsync(`UPDATE matches SET result = ? WHERE id = ?`, [result, matchId]);
}

// Borra los resultados capturados de una ronda (deja las mesas y el
// AUTOWIN existente intactos, solo limpia a_win/b_win/draw/double_loss).
export async function clearRoundResults(roundId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE matches SET result = NULL WHERE round_id = ? AND player_b_id IS NOT NULL`,
    [roundId]
  );
}

// Reemplaza por completo las mesas de una ronda (pareo manual).
export async function replaceRoundMatches(roundId, pairs) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM matches WHERE round_id = ?`, [roundId]);
  let table = 1;
  for (const p of pairs) {
    const result = p.playerBId == null ? "bye_win" : null;
    await db.runAsync(
      `INSERT INTO matches (id, round_id, table_num, slot_index, player_a_id, player_b_id, result)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), roundId, table++, p.slotIndex ?? null, p.playerAId, p.playerBId, result]
    );
  }
}

/* ---------------- Carga completa de un torneo ----------------
   Junta jugadores + rondas en la forma que esperan lib/swiss.js y
   lib/bracket.js (que trabajan sobre objetos en memoria, sin saber
   nada de SQLite). */
export async function loadFullTournament(tournamentId) {
  const [tournament, players, rounds] = await Promise.all([
    getTournament(tournamentId),
    listPlayers(tournamentId),
    listRounds(tournamentId),
  ]);
  return {
    ...tournament,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      deck: p.deck,
      enabled: !!p.enabled,
      eliminated: !!p.eliminated,
      disabledRound: p.disabled_round ?? null,
    })),
    rounds,
  };
}
