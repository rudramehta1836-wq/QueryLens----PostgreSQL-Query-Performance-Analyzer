import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { validateQuery } = require('../services/sqlGuard');

describe('SQL Guard', () => {
  // =========== VALID QUERIES ===========
  describe('Valid queries', () => {
    it('should accept a simple SELECT', () => {
      const result = validateQuery('SELECT * FROM orders WHERE customer_id = 1');
      expect(result).toBeDefined();
      expect(result.sql).toContain('SELECT');
    });

    it('should accept SELECT with explicit columns', () => {
      const result = validateQuery("SELECT id, name, email FROM customers WHERE city = 'Mumbai'");
      expect(result.sql).toContain('SELECT');
    });

    it('should accept a WITH ... SELECT (CTE)', () => {
      const result = validateQuery(`
        WITH recent_orders AS (
          SELECT * FROM orders WHERE order_date > '2024-01-01'
        )
        SELECT * FROM recent_orders LIMIT 10
      `);
      expect(result.sql).toContain('WITH');
    });

    it('should accept SELECT with JOIN', () => {
      const result = validateQuery(`
        SELECT c.name, o.id
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        WHERE c.city = 'Mumbai'
      `);
      expect(result.sql).toContain('JOIN');
    });

    it('should accept SELECT with subquery', () => {
      const result = validateQuery(`
        SELECT * FROM customers
        WHERE id IN (SELECT customer_id FROM orders WHERE status = 'pending')
      `);
      expect(result.sql).toContain('SELECT');
    });

    it('should accept SELECT with aggregate functions', () => {
      const result = validateQuery(`
        SELECT category, COUNT(*), SUM(quantity)
        FROM order_items
        GROUP BY category
        HAVING COUNT(*) > 5
        ORDER BY COUNT(*) DESC
      `);
      expect(result.sql).toContain('GROUP BY');
    });

    it('should accept a trailing semicolon', () => {
      const result = validateQuery('SELECT 1;');
      expect(result.sql).toContain('SELECT');
    });
  });

  // =========== REJECTED QUERIES ===========
  describe('Rejected statement types', () => {
    it('should reject INSERT', () => {
      expect(() => validateQuery("INSERT INTO orders (customer_id) VALUES (1)"))
        .toThrow();
    });

    it('should reject UPDATE', () => {
      expect(() => validateQuery("UPDATE orders SET status = 'shipped' WHERE id = 1"))
        .toThrow();
    });

    it('should reject DELETE', () => {
      expect(() => validateQuery("DELETE FROM orders WHERE id = 1"))
        .toThrow();
    });

    it('should reject DROP', () => {
      expect(() => validateQuery("DROP TABLE orders"))
        .toThrow();
    });

    it('should reject ALTER', () => {
      expect(() => validateQuery("ALTER TABLE orders ADD COLUMN foo TEXT"))
        .toThrow();
    });

    it('should reject TRUNCATE', () => {
      expect(() => validateQuery("TRUNCATE TABLE orders"))
        .toThrow();
    });

    it('should reject CREATE', () => {
      expect(() => validateQuery("CREATE TABLE test (id INT)"))
        .toThrow();
    });
  });

  // =========== MULTIPLE STATEMENTS ===========
  describe('Multiple statements', () => {
    it('should reject semicolon-separated statements', () => {
      expect(() => validateQuery("SELECT 1; DROP TABLE orders"))
        .toThrow();
    });

    it('should reject two SELECT statements', () => {
      expect(() => validateQuery("SELECT 1; SELECT 2"))
        .toThrow();
    });
  });

  // =========== COMMENT INJECTION ===========
  describe('Comment injection', () => {
    it('should reject line comment hiding unsafe SQL', () => {
      expect(() => validateQuery("SELECT 1; -- safe\nDROP TABLE orders"))
        .toThrow();
    });

    it('should reject block comment hiding unsafe SQL', () => {
      expect(() => validateQuery("SELECT 1; /* harmless */ DROP TABLE orders"))
        .toThrow();
    });
  });

  // =========== DANGEROUS FUNCTIONS ===========
  describe('Dangerous functions', () => {
    it('should reject pg_read_file', () => {
      expect(() => validateQuery("SELECT pg_read_file('/etc/passwd')"))
        .toThrow();
    });

    it('should reject pg_ls_dir', () => {
      expect(() => validateQuery("SELECT pg_ls_dir('/tmp')"))
        .toThrow();
    });

    it('should reject lo_import', () => {
      expect(() => validateQuery("SELECT lo_import('/etc/passwd')"))
        .toThrow();
    });

    it('should reject pg_sleep', () => {
      expect(() => validateQuery("SELECT pg_sleep(10)"))
        .toThrow();
    });

    it('should reject dblink', () => {
      expect(() => validateQuery("SELECT * FROM dblink('host=evil', 'SELECT 1') AS t(id INT)"))
        .toThrow();
    });
  });

  // =========== EDGE CASES ===========
  describe('Edge cases', () => {
    it('should reject empty string', () => {
      expect(() => validateQuery('')).toThrow();
    });

    it('should reject null', () => {
      expect(() => validateQuery(null)).toThrow();
    });

    it('should reject whitespace-only', () => {
      expect(() => validateQuery('   ')).toThrow();
    });

    it('should reject very long queries', () => {
      const longQuery = 'SELECT ' + 'a'.repeat(5001);
      expect(() => validateQuery(longQuery)).toThrow();
    });
  });
});
