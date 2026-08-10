import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import database from './db.js'

const app = express()
const secret = process.env.JWT_SECRET || 'quizly-development-secret-change-me'
app.use(cors())
app.use(express.json({ limit: '50kb' }))

const issueToken = (user) => jwt.sign({ id: user.id, role: user.role, email: user.email }, secret, { expiresIn: '8h' })
const auth = (request, response, next) => {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ error: 'Authentication required' })
  try { request.user = jwt.verify(header.slice(7), secret); next() } catch { response.status(401).json({ error: 'Invalid or expired token' }) }
}
const requireRole = (role) => (request, response, next) => request.user?.role === role ? next() : response.status(403).json({ error: `${role} access required` })
const validate = (body, fields) => fields.filter((field) => typeof body[field] !== 'string' || !body[field].trim())

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.post('/api/auth/register', (request, response) => {
  const missing = validate(request.body, ['name', 'email', 'password'])
  if (missing.length || request.body.password.length < 8) return response.status(400).json({ error: 'Name, email, and a password of 8+ characters are required' })
  try {
    const passwordHash = bcrypt.hashSync(request.body.password, 12)
    const result = database.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(request.body.name.trim(), request.body.email.toLowerCase().trim(), passwordHash)
    const user = database.prepare('SELECT id,name,email,role FROM users WHERE id = ?').get(result.lastInsertRowid)
    response.status(201).json({ user, token: issueToken(user) })
  } catch { response.status(409).json({ error: 'An account with that email already exists' }) }
})
app.post('/api/auth/login', (request, response) => {
  const user = database.prepare('SELECT * FROM users WHERE email = ?').get(request.body.email?.toLowerCase().trim())
  if (!user || !bcrypt.compareSync(request.body.password || '', user.password_hash)) return response.status(401).json({ error: 'Invalid email or password' })
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role }
  response.json({ user: safeUser, token: issueToken(safeUser) })
})
app.get('/api/auth/me', auth, (request, response) => response.json(database.prepare('SELECT id,name,email,role FROM users WHERE id = ?').get(request.user.id)))

const quizSelect = `SELECT q.id,q.title,q.description,q.duration_minutes AS durationMinutes,q.published,c.name AS category FROM quizzes q JOIN categories c ON c.id=q.category_id`
app.get('/api/quizzes', auth, (request, response) => response.json(database.prepare(`${quizSelect} WHERE q.published = 1 ORDER BY q.created_at DESC`).all()))
app.get('/api/quizzes/:id', auth, (request, response) => {
  const quiz = database.prepare(`${quizSelect} WHERE q.id = ?`).get(request.params.id)
  if (!quiz) return response.status(404).json({ error: 'Quiz not found' })
  const questions = database.prepare('SELECT id,prompt,explanation,position FROM questions WHERE quiz_id=? ORDER BY position').all(request.params.id).map((question) => ({ ...question, options: database.prepare('SELECT id,label FROM options WHERE question_id=?').all(question.id) }))
  response.json({ ...quiz, questions })
})
app.post('/api/quizzes', auth, requireRole('admin'), (request, response) => {
  const missing = validate(request.body, ['title', 'category'])
  if (missing.length) return response.status(400).json({ error: 'Title and category are required' })
  let category = database.prepare('SELECT id FROM categories WHERE name=?').get(request.body.category)
  if (!category) category = { id: database.prepare('INSERT INTO categories (name) VALUES (?)').run(request.body.category.trim()).lastInsertRowid }
  const result = database.prepare('INSERT INTO quizzes (title,description,category_id,duration_minutes,published,created_by) VALUES (?,?,?,?,?,?)').run(request.body.title.trim(), request.body.description || '', category.id, Number(request.body.durationMinutes) || 15, request.body.published ? 1 : 0, request.user.id)
  response.status(201).json({ id: result.lastInsertRowid })
})
app.patch('/api/quizzes/:id', auth, requireRole('admin'), (request, response) => {
  const fields = []; const values = []
  for (const field of ['title', 'description', 'durationMinutes', 'published']) if (request.body[field] !== undefined) { fields.push(`${field === 'durationMinutes' ? 'duration_minutes' : field}=?`); values.push(field === 'published' ? (request.body[field] ? 1 : 0) : request.body[field]) }
  if (!fields.length) return response.status(400).json({ error: 'No editable fields supplied' })
  database.prepare(`UPDATE quizzes SET ${fields.join(',')} WHERE id=?`).run(...values, request.params.id)
  response.json({ updated: true })
})
app.delete('/api/quizzes/:id', auth, requireRole('admin'), (request, response) => { database.prepare('DELETE FROM quizzes WHERE id=?').run(request.params.id); response.status(204).end() })
app.get('/api/categories', auth, (_request, response) => response.json(database.prepare('SELECT id,name FROM categories ORDER BY name').all()))
app.post('/api/quizzes/:id/questions', auth, requireRole('admin'), (request, response) => {
  if (!request.body.prompt || !Array.isArray(request.body.options) || request.body.options.length < 2 || !request.body.options.some((option) => option.correct)) return response.status(400).json({ error: 'Prompt, two options, and one correct answer are required' })
  const insert = database.transaction(() => { const question = database.prepare('INSERT INTO questions (quiz_id,prompt,explanation,position) VALUES (?,?,?,?)').run(request.params.id, request.body.prompt.trim(), request.body.explanation || '', Number(request.body.position) || 1); for (const option of request.body.options) database.prepare('INSERT INTO options (question_id,label,is_correct) VALUES (?,?,?)').run(question.lastInsertRowid, option.label.trim(), option.correct ? 1 : 0); return question.lastInsertRowid })
  response.status(201).json({ id: insert() })
})

app.post('/api/attempts', auth, (request, response) => {
  const quiz = database.prepare('SELECT id,duration_minutes AS durationMinutes FROM quizzes WHERE id=? AND published=1').get(request.body.quizId)
  if (!quiz) return response.status(404).json({ error: 'Published quiz not found' })
  const attempt = database.prepare('INSERT INTO attempts (user_id,quiz_id) VALUES (?,?)').run(request.user.id, quiz.id)
  response.status(201).json({ id: attempt.lastInsertRowid, quizId: quiz.id, durationMinutes: quiz.durationMinutes })
})
app.post('/api/attempts/:id/submit', auth, (request, response) => {
  const attempt = database.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(request.params.id, request.user.id)
  if (!attempt) return response.status(404).json({ error: 'Attempt not found' })
  if (attempt.submitted_at) return response.status(409).json({ error: 'Attempt already submitted' })
  const questions = database.prepare('SELECT id FROM questions WHERE quiz_id=?').all(attempt.quiz_id)
  const submitted = Array.isArray(request.body.answers) ? request.body.answers : []
  const score = questions.reduce((total, question) => total + (submitted.find((answer) => answer.questionId === question.id && database.prepare('SELECT is_correct FROM options WHERE id=? AND question_id=?').get(answer.optionId, question.id)?.is_correct) ? 1 : 0), 0)
  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0
  const save = database.transaction(() => { for (const answer of submitted) database.prepare('INSERT INTO answers (attempt_id,question_id,option_id) VALUES (?,?,?)').run(attempt.id, answer.questionId, answer.optionId || null); database.prepare('UPDATE attempts SET submitted_at=CURRENT_TIMESTAMP,score=?,passed=? WHERE id=?').run(percent, percent >= 60 ? 1 : 0, attempt.id) })
  save()
  response.json({ attemptId: attempt.id, score: percent, passed: percent >= 60 })
})
app.get('/api/attempts', auth, (request, response) => response.json(database.prepare('SELECT a.id,a.score,a.passed,a.started_at AS startedAt,a.submitted_at AS submittedAt,q.title FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.user_id=? ORDER BY a.started_at DESC').all(request.user.id)))
app.get('/api/analytics/student', auth, (request, response) => response.json(database.prepare('SELECT COUNT(*) AS completed, COALESCE(ROUND(AVG(score)),0) AS averageScore, COALESCE(SUM(score >= 60),0) AS passed FROM attempts WHERE user_id=? AND submitted_at IS NOT NULL').get(request.user.id)))
app.get('/api/analytics/admin', auth, requireRole('admin'), (_request, response) => response.json({ students: database.prepare("SELECT COUNT(*) AS count FROM users WHERE role='student'").get().count, quizzes: database.prepare('SELECT COUNT(*) AS count FROM quizzes').get().count, attempts: database.prepare('SELECT COUNT(*) AS count FROM attempts').get().count, passRate: database.prepare('SELECT COALESCE(ROUND(AVG(passed)*100),0) AS rate FROM attempts WHERE submitted_at IS NOT NULL').get().rate }))
app.get('/api/leaderboard', auth, (_request, response) => response.json(database.prepare("SELECT u.name,COALESCE(SUM(a.score),0) AS points,COUNT(a.id) AS attempts FROM users u LEFT JOIN attempts a ON a.user_id=u.id AND a.submitted_at IS NOT NULL WHERE u.role='student' GROUP BY u.id ORDER BY points DESC LIMIT 20").all()))

if (!process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== 'test') app.listen(process.env.PORT || 4000, () => console.log(`Quizly API listening on port ${process.env.PORT || 4000}`))
export default app
