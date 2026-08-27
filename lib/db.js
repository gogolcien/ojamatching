// Capa de datos: SQLite local (expo-sqlite), sin ningún acceso a red.
// Un solo archivo de base de datos vive en el dispositivo y guarda
// todos los torneos del organizador.
import * as SQLite from "expo-sqlite";

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("ligas_torneos.db");
  }
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'swiss', -- 'swiss' | 'elimination'
      status TEXT NOT NULL DEFAULT 'ongoing', -- 'ongoing' | 'finished'
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      deck TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      eliminated INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      disabled_round INTEGER
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL
    );

    -- slot_index: posición fija dentro del bracket (solo se usa en
    -- formato 'elimination', para saber a qué mesa de la siguiente
    -- ronda avanza el ganador). En 'swiss' se deja en NULL.
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      table_num INTEGER NOT NULL,
      slot_index INTEGER,
      player_a_id TEXT REFERENCES players(id),
      player_b_id TEXT REFERENCES players(id),
      result TEXT -- 'a_win' | 'b_win' | 'draw' | 'double_loss' | 'bye_win' | 'bye_loss' | NULL
    );
  `);

  // Migración para bases de datos creadas antes de que existiera esta
  // columna (ALTER TABLE ... ADD COLUMN falla si ya existe, se ignora).
  try {
    await db.execAsync(`ALTER TABLE players ADD COLUMN disabled_round INTEGER;`);
  } catch (e) {
    // La columna ya existe, no hay nada que hacer.
  }

  // is_third_place: distingue, dentro de la ronda final de un bracket
  // de eliminación, la mesa del partido por el 3er lugar de la mesa
  // de la Final propiamente dicha (ambas mesas conviven en la misma
  // ronda, la última del torneo).
  try {
    await db.execAsync(`ALTER TABLE matches ADD COLUMN is_third_place INTEGER NOT NULL DEFAULT 0;`);
  } catch (e) {
    // La columna ya existe, no hay nada que hacer.
  }

  // source_tournament_id: si este torneo nació como "Top Cut" armado
  // desde los standings de otro torneo suizo, aquí queda el id del
  // torneo original (solo informativo, no hay integridad referencial
  // porque el torneo origen puede borrarse sin afectar el Top Cut).
  try {
    await db.execAsync(`ALTER TABLE tournaments ADD COLUMN source_tournament_id TEXT;`);
  } catch (e) {
    // La columna ya existe, no hay nada que hacer.
  }

  return db;
}
