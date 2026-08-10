import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const database = new Database(process.env.DATABASE_PATH || 'quizly.db')
database.pragma('foreign_keys = ON')
database.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS quizzes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category_id INTEGER NOT NULL REFERENCES categories(id), duration_minutes INTEGER NOT NULL DEFAULT 15, published INTEGER NOT NULL DEFAULT 0, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, prompt TEXT NOT NULL, explanation TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS options (id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE, label TEXT NOT NULL, is_correct INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), quiz_id INTEGER NOT NULL REFERENCES quizzes(id), started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, submitted_at TEXT, score INTEGER, passed INTEGER);
  CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY, attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE, question_id INTEGER NOT NULL REFERENCES questions(id), option_id INTEGER REFERENCES options(id));
`)

const addColumn = (table, column, definition) => {
  const exists = database.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column)
  if (!exists) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}
addColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'")
addColumn('users', 'reset_token', 'TEXT')
addColumn('users', 'reset_expires_at', 'TEXT')
addColumn('quizzes', 'negative_mark', 'REAL NOT NULL DEFAULT 0')
addColumn('quizzes', 'max_attempts', 'INTEGER NOT NULL DEFAULT 0')
addColumn('quizzes', 'available_from', 'TEXT')
addColumn('quizzes', 'available_until', 'TEXT')
addColumn('attempts', 'question_order', 'TEXT')
addColumn('attempts', 'certificate_issued', 'INTEGER NOT NULL DEFAULT 0')

const seed = database.transaction(() => {
  const admin = database.prepare('SELECT id FROM users WHERE email = ?').get('admin@quizly.local')
  if (!admin) database.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run('Quizly Admin', 'admin@quizly.local', bcrypt.hashSync('Admin123!', 10), 'admin')
  const student = database.prepare('SELECT id FROM users WHERE email = ?').get('student@quizly.local')
  if (!student) database.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run('Alex Morgan', 'student@quizly.local', bcrypt.hashSync('Student123!', 10), 'student')
  if (database.prepare('SELECT COUNT(*) AS count FROM categories').get().count === 0) {
    database.prepare('INSERT INTO categories (name) VALUES (?)').run('Development')
    database.prepare('INSERT INTO categories (name) VALUES (?)').run('Design')
  }
  if (database.prepare('SELECT COUNT(*) AS count FROM quizzes').get().count === 0) {
    const development = database.prepare('SELECT id FROM categories WHERE name = ?').get('Development').id
    const quiz = database.prepare('INSERT INTO quizzes (title,description,category_id,duration_minutes,published,created_by) VALUES (?,?,?,?,?,?)').run('JavaScript Foundations', 'Core language concepts and browser APIs.', development, 18, 1, 1)
    const question = database.prepare('INSERT INTO questions (quiz_id,prompt,explanation,position) VALUES (?,?,?,?)').run(quiz.lastInsertRowid, 'Which keyword declares a block-scoped variable?', 'let and const are block scoped.', 1)
    for (const option of [['var', 0], ['let', 1], ['global', 0], ['define', 0]]) database.prepare('INSERT INTO options (question_id,label,is_correct) VALUES (?,?,?)').run(question.lastInsertRowid, ...option)
  }
})
seed()
export default database
