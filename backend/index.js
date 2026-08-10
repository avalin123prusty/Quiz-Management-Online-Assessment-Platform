import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import crypto from 'node:crypto'
import database from './db.js'

const app = express()
const secret = process.env.JWT_SECRET || 'quizly-development-secret-change-me'
app.use(cors({ origin: (_origin, callback) => callback(null, true) }))
app.use(helmet())
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false }))
app.use(express.json({ limit: '50kb' }))

app.get('/', (_request, response) => response.json({ name: 'Quizly API', status: 'online', health: '/api/health' }))

const issueToken = (user) => jwt.sign({ id: user.id, role: user.role, email: user.email }, secret, { expiresIn: '8h' })
const auth = (request, response, next) => {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ error: 'Authentication required' })
  try { request.user = jwt.verify(header.slice(7), secret); const account = database.prepare('SELECT status FROM users WHERE id=?').get(request.user.id); if (!account || account.status !== 'active') return response.status(403).json({ error: 'Account is suspended' }); next() } catch { response.status(401).json({ error: 'Invalid or expired token' }) }
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
app.post('/api/auth/logout', auth, (_request, response) => response.status(204).end())
app.post('/api/auth/forgot-password', (request, response) => {
  const user = database.prepare('SELECT id FROM users WHERE email=?').get(request.body.email?.toLowerCase().trim())
  if (user) { const token = crypto.randomBytes(24).toString('hex'); database.prepare("UPDATE users SET reset_token=?,reset_expires_at=datetime('now','+30 minutes') WHERE id=?").run(token, user.id) }
  response.json({ message: 'If the email exists, a reset link has been created' })
})
app.post('/api/auth/reset-password', (request, response) => {
  const user = database.prepare("SELECT id FROM users WHERE reset_token=? AND reset_expires_at > datetime('now')").get(request.body.token)
  if (!user || typeof request.body.password !== 'string' || request.body.password.length < 8) return response.status(400).json({ error: 'Invalid token or password' })
  database.prepare('UPDATE users SET password_hash=?,reset_token=NULL,reset_expires_at=NULL WHERE id=?').run(bcrypt.hashSync(request.body.password, 12), user.id)
  response.json({ reset: true })
})
app.get('/api/auth/me', auth, (request, response) => response.json(database.prepare('SELECT id,name,email,role,status FROM users WHERE id = ?').get(request.user.id)))

app.get('/api/users', auth, requireRole('admin'), (_request, response) => response.json(database.prepare('SELECT id,name,email,role,status,created_at AS createdAt FROM users ORDER BY created_at DESC').all()))
app.get('/api/users/:id', auth, requireRole('admin'), (request, response) => { const user = database.prepare('SELECT id,name,email,role,status,created_at AS createdAt FROM users WHERE id=?').get(request.params.id); if (!user) return response.status(404).json({ error: 'User not found' }); response.json(user) })
app.put('/api/users/:id', auth, requireRole('admin'), (request, response) => {
  const fields = []; const values = []
  for (const field of ['name', 'email', 'role']) if (request.body[field] !== undefined) { fields.push(`${field}=?`); values.push(String(request.body[field]).trim()) }
  if (!fields.length) return response.status(400).json({ error: 'No editable fields supplied' })
  database.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...values, request.params.id); response.json({ updated: true })
})
app.delete('/api/users/:id', auth, requireRole('admin'), (request, response) => { if (Number(request.params.id) === request.user.id) return response.status(400).json({ error: 'You cannot delete your own account' }); database.prepare('DELETE FROM users WHERE id=?').run(request.params.id); response.status(204).end() })
app.patch('/api/users/:id/status', auth, requireRole('admin'), (request, response) => { if (!['active', 'suspended'].includes(request.body.status)) return response.status(400).json({ error: 'Status must be active or suspended' }); database.prepare('UPDATE users SET status=? WHERE id=?').run(request.body.status, request.params.id); response.json({ updated: true }) })

const quizSelect = `SELECT q.id,q.title,q.description,q.duration_minutes AS durationMinutes,q.published,q.negative_mark AS negativeMark,q.max_attempts AS maxAttempts,q.available_from AS availableFrom,q.available_until AS availableUntil,c.name AS category FROM quizzes q JOIN categories c ON c.id=q.category_id`
app.get('/api/quizzes', auth, (request, response) => response.json(database.prepare(`${quizSelect} WHERE q.published = 1 ORDER BY q.created_at DESC`).all()))
app.get('/api/quizzes/:id', auth, (request, response) => {
  const quiz = database.prepare(`${quizSelect} WHERE q.id = ?`).get(request.params.id)
  if (!quiz) return response.status(404).json({ error: 'Quiz not found' })
  const questions = shuffle(database.prepare('SELECT id,prompt,explanation,position FROM questions WHERE quiz_id=? ORDER BY position').all(request.params.id)).map((question) => ({ ...question, options: shuffle(database.prepare('SELECT id,label FROM options WHERE question_id=?').all(question.id)) }))
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
const updateQuiz = (request, response) => {
  const fields = []; const values = []
  for (const field of ['title', 'description', 'durationMinutes', 'published', 'negativeMark', 'maxAttempts', 'availableFrom', 'availableUntil']) if (request.body[field] !== undefined) { const column = { durationMinutes: 'duration_minutes', negativeMark: 'negative_mark', maxAttempts: 'max_attempts', availableFrom: 'available_from', availableUntil: 'available_until' }[field] || field; fields.push(`${column}=?`); values.push(field === 'published' ? (request.body[field] ? 1 : 0) : request.body[field]) }
  if (!fields.length) return response.status(400).json({ error: 'No editable fields supplied' })
  database.prepare(`UPDATE quizzes SET ${fields.join(',')} WHERE id=?`).run(...values, request.params.id)
  response.json({ updated: true })
}
app.patch('/api/quizzes/:id', auth, requireRole('admin'), updateQuiz)
app.put('/api/quizzes/:id', auth, requireRole('admin'), updateQuiz)
app.patch('/api/quizzes/:id/publish', auth, requireRole('admin'), (request, response) => { database.prepare('UPDATE quizzes SET published=? WHERE id=?').run(request.body.published === false ? 0 : 1, request.params.id); response.json({ published: request.body.published !== false }) })
app.delete('/api/quizzes/:id', auth, requireRole('admin'), (request, response) => { database.prepare('DELETE FROM quizzes WHERE id=?').run(request.params.id); response.status(204).end() })
app.get('/api/categories', auth, (_request, response) => response.json(database.prepare('SELECT id,name FROM categories ORDER BY name').all()))
app.post('/api/categories', auth, requireRole('admin'), (request, response) => { if (!request.body.name?.trim()) return response.status(400).json({ error: 'Name is required' }); try { const result = database.prepare('INSERT INTO categories (name) VALUES (?)').run(request.body.name.trim()); response.status(201).json({ id: result.lastInsertRowid, name: request.body.name.trim() }) } catch { response.status(409).json({ error: 'Category already exists' }) } })
app.put('/api/categories/:id', auth, requireRole('admin'), (request, response) => { if (!request.body.name?.trim()) return response.status(400).json({ error: 'Name is required' }); database.prepare('UPDATE categories SET name=? WHERE id=?').run(request.body.name.trim(), request.params.id); response.json({ updated: true }) })
app.delete('/api/categories/:id', auth, requireRole('admin'), (request, response) => { try { database.prepare('DELETE FROM categories WHERE id=?').run(request.params.id); response.status(204).end() } catch { response.status(409).json({ error: 'Category is in use by a quiz' }) } })
app.get('/api/quizzes/:quizId/questions', auth, requireRole('admin'), (request, response) => response.json(database.prepare('SELECT id,prompt,explanation,position FROM questions WHERE quiz_id=? ORDER BY position').all(request.params.quizId).map((question) => ({ ...question, options: database.prepare('SELECT id,label,is_correct AS correct FROM options WHERE question_id=?').all(question.id) }))))
app.post('/api/quizzes/:id/questions', auth, requireRole('admin'), (request, response) => {
  if (!request.body.prompt || !Array.isArray(request.body.options) || request.body.options.length < 2 || !request.body.options.some((option) => option.correct)) return response.status(400).json({ error: 'Prompt, two options, and one correct answer are required' })
  const insert = database.transaction(() => { const question = database.prepare('INSERT INTO questions (quiz_id,prompt,explanation,position) VALUES (?,?,?,?)').run(request.params.id, request.body.prompt.trim(), request.body.explanation || '', Number(request.body.position) || 1); for (const option of request.body.options) database.prepare('INSERT INTO options (question_id,label,is_correct) VALUES (?,?,?)').run(question.lastInsertRowid, option.label.trim(), option.correct ? 1 : 0); return question.lastInsertRowid })
  response.status(201).json({ id: insert() })
})
app.put('/api/questions/:id', auth, requireRole('admin'), (request, response) => { if (!request.body.prompt?.trim()) return response.status(400).json({ error: 'Prompt is required' }); database.prepare('UPDATE questions SET prompt=?,explanation=?,position=? WHERE id=?').run(request.body.prompt.trim(), request.body.explanation || '', Number(request.body.position) || 1, request.params.id); response.json({ updated: true }) })
app.delete('/api/questions/:id', auth, requireRole('admin'), (request, response) => { database.prepare('DELETE FROM questions WHERE id=?').run(request.params.id); response.status(204).end() })

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5)
const startAttempt = (request, response) => {
  const quiz = database.prepare('SELECT id,duration_minutes AS durationMinutes,max_attempts AS maxAttempts,available_from AS availableFrom,available_until AS availableUntil FROM quizzes WHERE id=? AND published=1').get(request.params.quizId || request.body.quizId)
  if (!quiz) return response.status(404).json({ error: 'Published quiz not found' })
  const now = Date.now(); if (quiz.availableFrom && now < Date.parse(quiz.availableFrom) || quiz.availableUntil && now > Date.parse(quiz.availableUntil)) return response.status(409).json({ error: 'Quiz is outside its availability window' })
  const completed = database.prepare("SELECT COUNT(*) AS count FROM attempts WHERE user_id=? AND quiz_id=? AND submitted_at IS NOT NULL").get(request.user.id, quiz.id).count
  if (quiz.maxAttempts > 0 && completed >= quiz.maxAttempts) return response.status(409).json({ error: 'Maximum attempts reached' })
  const questionIds = shuffle(database.prepare('SELECT id FROM questions WHERE quiz_id=?').all(quiz.id).map((question) => question.id))
  const attempt = database.prepare('INSERT INTO attempts (user_id,quiz_id,question_order) VALUES (?,?,?)').run(request.user.id, quiz.id, JSON.stringify(questionIds))
  response.status(201).json({ id: attempt.lastInsertRowid, quizId: quiz.id, durationMinutes: quiz.durationMinutes, questionOrder: questionIds })
}
app.post('/api/attempts', auth, (request, response) => startAttempt(request, response))
app.post('/api/quizzes/:quizId/start', auth, startAttempt)
const submitAttempt = (request, response) => {
  const attempt = database.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(request.params.id, request.user.id)
  if (!attempt) return response.status(404).json({ error: 'Attempt not found' })
  if (attempt.submitted_at) return response.status(409).json({ error: 'Attempt already submitted' })
  const questions = database.prepare('SELECT id FROM questions WHERE quiz_id=?').all(attempt.quiz_id)
  const submitted = Array.isArray(request.body.answers) ? request.body.answers : []
  const quiz = database.prepare('SELECT negative_mark FROM quizzes WHERE id=?').get(attempt.quiz_id)
  const correct = submitted.reduce((total, answer) => total + (database.prepare('SELECT is_correct FROM options WHERE id=? AND question_id=?').get(answer.optionId, answer.questionId)?.is_correct ? 1 : 0), 0)
  const wrong = submitted.filter((answer) => !database.prepare('SELECT is_correct FROM options WHERE id=? AND question_id=?').get(answer.optionId, answer.questionId)?.is_correct).length
  const rawScore = correct - wrong * Number(quiz.negative_mark || 0)
  const percent = questions.length ? Math.max(0, Math.round((rawScore / questions.length) * 100)) : 0
  const save = database.transaction(() => { for (const answer of submitted) database.prepare('INSERT INTO answers (attempt_id,question_id,option_id) VALUES (?,?,?)').run(attempt.id, answer.questionId, answer.optionId || null); database.prepare('UPDATE attempts SET submitted_at=CURRENT_TIMESTAMP,score=?,passed=?,certificate_issued=? WHERE id=?').run(percent, percent >= 60 ? 1 : 0, percent >= 60 ? 1 : 0, attempt.id) })
  save()
  response.json({ attemptId: attempt.id, score: percent, correct, wrong, passed: percent >= 60, certificateAvailable: percent >= 60 })
}
app.post('/api/attempts/:id/submit', auth, submitAttempt)
app.post('/api/quizzes/:quizId/submit', auth, (request, response) => { request.params.id = request.body.attemptId; submitAttempt(request, response) })
app.get('/api/attempts', auth, (request, response) => response.json(database.prepare('SELECT a.id,a.score,a.passed,a.started_at AS startedAt,a.submitted_at AS submittedAt,q.title FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.user_id=? ORDER BY a.started_at DESC').all(request.user.id)))
app.get('/api/attempts/:id', auth, (request, response) => { const attempt = database.prepare('SELECT a.id,a.score,a.passed,a.started_at AS startedAt,a.submitted_at AS submittedAt,q.title FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.id=? AND a.user_id=?').get(request.params.id, request.user.id); if (!attempt) return response.status(404).json({ error: 'Attempt not found' }); response.json({ ...attempt, answers: database.prepare('SELECT an.question_id AS questionId,an.option_id AS optionId,qu.prompt,qu.explanation,op.is_correct AS correct FROM answers an JOIN questions qu ON qu.id=an.question_id LEFT JOIN options op ON op.id=an.option_id WHERE an.attempt_id=?').all(request.params.id) }) })
app.get('/api/attempts/:id/certificate', auth, (request, response) => { const attempt = database.prepare('SELECT a.id,a.score,a.passed,q.title,u.name FROM attempts a JOIN quizzes q ON q.id=a.quiz_id JOIN users u ON u.id=a.user_id WHERE a.id=? AND a.user_id=?').get(request.params.id, request.user.id); if (!attempt) return response.status(404).json({ error: 'Attempt not found' }); if (!attempt.passed) return response.status(409).json({ error: 'Certificate is available only after passing' }); response.json({ certificateId: `QUIZLY-${attempt.id}`, recipient: attempt.name, quiz: attempt.title, score: attempt.score, issuedAt: new Date().toISOString() }) })
app.get('/api/admin/attempts', auth, requireRole('admin'), (_request, response) => response.json(database.prepare('SELECT a.*,u.name AS student,q.title FROM attempts a JOIN users u ON u.id=a.user_id JOIN quizzes q ON q.id=a.quiz_id ORDER BY a.started_at DESC').all()))
app.get('/api/admin/attempts/:id', auth, requireRole('admin'), (request, response) => { const attempt = database.prepare('SELECT a.*,u.name AS student,q.title FROM attempts a JOIN users u ON u.id=a.user_id JOIN quizzes q ON q.id=a.quiz_id WHERE a.id=?').get(request.params.id); if (!attempt) return response.status(404).json({ error: 'Attempt not found' }); response.json(attempt) })
app.get('/api/analytics/student', auth, (request, response) => response.json(database.prepare('SELECT COUNT(*) AS completed, COALESCE(ROUND(AVG(score)),0) AS averageScore, COALESCE(SUM(score >= 60),0) AS passed FROM attempts WHERE user_id=? AND submitted_at IS NOT NULL').get(request.user.id)))
app.get('/api/analytics/admin', auth, requireRole('admin'), (_request, response) => response.json({ students: database.prepare("SELECT COUNT(*) AS count FROM users WHERE role='student'").get().count, quizzes: database.prepare('SELECT COUNT(*) AS count FROM quizzes').get().count, attempts: database.prepare('SELECT COUNT(*) AS count FROM attempts').get().count, passRate: database.prepare('SELECT COALESCE(ROUND(AVG(passed)*100),0) AS rate FROM attempts WHERE submitted_at IS NOT NULL').get().rate }))
app.get('/api/leaderboard', auth, (_request, response) => response.json(database.prepare("SELECT u.name,COALESCE(SUM(a.score),0) AS points,COUNT(a.id) AS attempts FROM users u LEFT JOIN attempts a ON a.user_id=u.id AND a.submitted_at IS NOT NULL WHERE u.role='student' GROUP BY u.id ORDER BY points DESC LIMIT 20").all()))

if (!process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== 'test') app.listen(process.env.PORT || 4000, () => console.log(`Quizly API listening on port ${process.env.PORT || 4000}`))
export default app
