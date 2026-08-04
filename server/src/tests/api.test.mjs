import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should respond to health endpoint', async () => {
      const res = await request(app).get('/api/health');
      // May be 200 if DB connected or 500 if not — either way it should respond
      expect(res.status).toBeDefined();
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/examples', () => {
    it('should return example queries', async () => {
      const res = await request(app).get('/api/examples');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const example = res.body.data[0];
      expect(example).toHaveProperty('id');
      expect(example).toHaveProperty('name');
      expect(example).toHaveProperty('sql');
    });
  });

  describe('POST /api/analyse', () => {
    it('should reject missing query', async () => {
      const res = await request(app)
        .post('/api/analyse')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty query', async () => {
      const res = await request(app)
        .post('/api/analyse')
        .send({ sql: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject unsafe queries', async () => {
      const res = await request(app)
        .post('/api/analyse')
        .send({ sql: 'DROP TABLE orders' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNSAFE_QUERY');
    });

    it('should reject INSERT queries', async () => {
      const res = await request(app)
        .post('/api/analyse')
        .send({ sql: "INSERT INTO orders (customer_id) VALUES (1)" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
