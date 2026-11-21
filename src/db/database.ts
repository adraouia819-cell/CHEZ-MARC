import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedDatabase } from './seed.ts';

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  const configured = process.env.DB_PATH || './data/casastyle.db';
  return path.resolve(process.cwd(), configured);
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  runMigrations(db);
  seedDatabase(db);

  dbInstance = db;
  return dbInstance;
}

function runMigrations(db: DatabaseSync): void {
  const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('Migrations directory not found.');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const checkStmt = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
  const insertStmt = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');

  for (const file of files) {
    const existing = checkStmt.get(file);
    if (!existing) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec('BEGIN;');
      try {
        db.exec(sql);
        insertStmt.run(file);
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
    }
  }
}
