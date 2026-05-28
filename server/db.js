import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

// Подключение / доступ к дб через файл .env (dannie k database)
export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || "postgres",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "111",
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      }
);

export async function initializeDatabase() {
  // Создание таблицы польз.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Создание таблицы для статы для каждого польз.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plays INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_played_at TIMESTAMPTZ
    );
  `);

  // Таблица возможных слов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wordle_words (
      id SERIAL PRIMARY KEY,
      word VARCHAR(16) UNIQUE NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Начальные слова:
  await pool.query(`
    INSERT INTO wordle_words (word)
    VALUES
      ('MUSIC'),
      ('GAMES'),
      ('REACT'),
      ('PLANT'),
      ('CHAIN'),
      ('STONE'),
      ('PHONE'),
      ('WORLD'),
      ('HEART'),
      ('EARTH')
    ON CONFLICT (word) DO NOTHING;
  `);
}
