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
