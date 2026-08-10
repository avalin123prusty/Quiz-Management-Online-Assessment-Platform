import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from './index.js'

test('health endpoint is public', async () => {
  const response = await request(app).get('/api/health')
  assert.equal(response.status, 200)
  assert.equal(response.body.status, 'ok')
})

test('registration and login return JWT authentication', async () => {
  const email = `test-${Date.now()}@example.com`
  const registration = await request(app).post('/api/auth/register').send({ name: 'Test Student', email, password: 'Password123' })
  assert.equal(registration.status, 201)
  assert.ok(registration.body.token)
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password123' })
  assert.equal(login.status, 200)
  assert.equal(login.body.user.role, 'student')
})

test('student cannot create an admin quiz', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'student@quizly.local', password: 'Student123!' })
  const response = await request(app).post('/api/quizzes').set('Authorization', `Bearer ${login.body.token}`).send({ title: 'Blocked', category: 'Security' })
  assert.equal(response.status, 403)
})

test('admin can list published quizzes', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@quizly.local', password: 'Admin123!' })
  const response = await request(app).get('/api/quizzes').set('Authorization', `Bearer ${login.body.token}`)
  assert.equal(response.status, 200)
  assert.ok(response.body.length >= 1)
})

test('admin CRUD endpoints and student attempt flow are protected and functional', async () => {
  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@quizly.local', password: 'Admin123!' })
  const studentLogin = await request(app).post('/api/auth/login').send({ email: 'student@quizly.local', password: 'Student123!' })
  const admin = { Authorization: `Bearer ${adminLogin.body.token}` }
  const student = { Authorization: `Bearer ${studentLogin.body.token}` }
  assert.equal((await request(app).get('/api/users').set(student)).status, 403)
  const category = await request(app).post('/api/categories').set(admin).send({ name: `Testing-${Date.now()}` })
  assert.equal(category.status, 201)
  const quiz = await request(app).post('/api/quizzes').set(admin).send({ title: 'Endpoint Coverage', category: category.body.name, published: true, maxAttempts: 2 })
  assert.equal(quiz.status, 201)
  const question = await request(app).post(`/api/quizzes/${quiz.body.id}/questions`).set(admin).send({ prompt: 'What is 2 + 2?', explanation: 'Basic arithmetic.', options: [{ label: '3', correct: false }, { label: '4', correct: true }] })
  assert.equal(question.status, 201)
  assert.equal((await request(app).get(`/api/quizzes/${quiz.body.id}/questions`).set(admin)).status, 200)
  const started = await request(app).post(`/api/quizzes/${quiz.body.id}/start`).set(student).send()
  assert.equal(started.status, 201)
  const detail = await request(app).get(`/api/quizzes/${quiz.body.id}`).set(student)
  const correctOption = detail.body.questions[0].options.find((option) => option.label === '4')
  const submitted = await request(app).post(`/api/quizzes/${quiz.body.id}/submit`).set(student).send({ attemptId: started.body.id, answers: [{ questionId: question.body.id, optionId: correctOption.id }] })
  assert.equal(submitted.status, 200)
  assert.equal(submitted.body.passed, true)
  assert.equal((await request(app).get(`/api/attempts/${started.body.id}`).set(student)).status, 200)
})
