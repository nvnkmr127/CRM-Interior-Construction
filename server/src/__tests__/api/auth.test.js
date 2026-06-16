const request = require('supertest')
const app     = require('../../app')

describe('Auth API', () => {
  let accessToken

  describe('POST /api/auth/login', () => {
    it('returns 200 and tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email:'admin@demo.com', password:'Admin@123', tenantSlug:'demo' })
      expect(res.status).toBe(200)
      expect(res.body.data.accessToken).toBeTruthy()
      expect(res.body.data.refreshToken).toBeTruthy()
      expect(res.body.data.user.email).toBe('admin@demo.com')
      accessToken = res.body.data.accessToken
    })

    it('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email:'admin@demo.com', password:'wrong', tenantSlug:'demo' })
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('returns 400 for missing email', async () => {
      const res = await request(app).post('/api/auth/login').send({ password:'x', tenantSlug:'demo' })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns user when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.user.email).toBe('admin@demo.com')
    })

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })
  })
})
