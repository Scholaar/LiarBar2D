import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'liarsbar.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      last_played TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name ON players(name COLLATE NOCASE);
  `);
}

export function recordGameResult(
  winnerName: string,
  loserNames: string[]
): void {
  const d = getDb();
  const upsertWin = d.prepare(`
    INSERT INTO players (name, wins, losses, last_played)
    VALUES (?, 1, 0, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      wins = wins + 1,
      last_played = datetime('now')
  `);
  upsertWin.run(winnerName);

  const upsertLoss = d.prepare(`
    INSERT INTO players (name, wins, losses, last_played)
    VALUES (?, 0, 1, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      losses = losses + 1,
      last_played = datetime('now')
  `);
  for (const name of loserNames) {
    upsertLoss.run(name);
  }
}

export function getPlayerStats(name: string): {
  name: string;
  wins: number;
  losses: number;
  winRate: number;
} | null {
  const d = getDb();
  const row = d
    .prepare('SELECT name, wins, losses FROM players WHERE name = ? COLLATE NOCASE')
    .get(name) as { name: string; wins: number; losses: number } | undefined;
  if (!row) return null;
  const total = row.wins + row.losses;
  return {
    name: row.name,
    wins: row.wins,
    losses: row.losses,
    winRate: total > 0 ? row.wins / total : 0,
  };
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
