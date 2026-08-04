import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  extractColumnsFromCondition,
  hasExistingIndex,
  generateIndexName
} = require('../analyzers/indexAdvisor');
const { quoteIdentifier, isValidIndexName } = require('../utils/identifiers');

describe('Index Advisor', () => {
  describe('extractColumnsFromCondition', () => {
    it('should extract a single column from equality condition', () => {
      const columns = extractColumnsFromCondition('(customer_id = 2500)');
      expect(columns).toContain('customer_id');
    });

    it('should extract columns from string equality', () => {
      const columns = extractColumnsFromCondition("(shipping_city = 'Mumbai'::text)");
      expect(columns).toContain('shipping_city');
    });

    it('should return empty for null input', () => {
      expect(extractColumnsFromCondition(null)).toEqual([]);
    });

    it('should not include SQL reserved words', () => {
      const columns = extractColumnsFromCondition("(status = 'pending')");
      expect(columns).not.toContain('pending');
    });
  });

  describe('hasExistingIndex', () => {
    it('should detect an existing index', () => {
      const indexes = [
        {
          tablename: 'orders',
          indexname: 'idx_orders_customer_id',
          indexdef: 'CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id)'
        }
      ];
      expect(hasExistingIndex(indexes, 'orders', ['customer_id'])).toBe(true);
    });

    it('should return false when no matching index', () => {
      const indexes = [
        {
          tablename: 'orders',
          indexname: 'orders_pkey',
          indexdef: 'CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)'
        }
      ];
      expect(hasExistingIndex(indexes, 'orders', ['customer_id'])).toBe(false);
    });

    it('should return false for different table', () => {
      const indexes = [
        {
          tablename: 'customers',
          indexname: 'idx_customers_email',
          indexdef: 'CREATE INDEX idx_customers_email ON public.customers USING btree (email)'
        }
      ];
      expect(hasExistingIndex(indexes, 'orders', ['email'])).toBe(false);
    });
  });

  describe('generateIndexName', () => {
    it('should generate correct single-column index name', () => {
      expect(generateIndexName('orders', ['customer_id']))
        .toBe('idx_orders_customer_id');
    });

    it('should generate correct multi-column index name', () => {
      expect(generateIndexName('orders', ['status', 'order_date']))
        .toBe('idx_orders_status_order_date');
    });
  });

  describe('quoteIdentifier', () => {
    it('should quote valid identifiers', () => {
      expect(quoteIdentifier('orders')).toBe('"orders"');
      expect(quoteIdentifier('customer_id')).toBe('"customer_id"');
    });

    it('should reject unsafe identifiers', () => {
      expect(() => quoteIdentifier('orders; DROP TABLE')).toThrow();
      expect(() => quoteIdentifier("Robert'); DROP TABLE")).toThrow();
    });

    it('should reject empty identifiers', () => {
      expect(() => quoteIdentifier('')).toThrow();
      expect(() => quoteIdentifier(null)).toThrow();
    });
  });

  describe('isValidIndexName', () => {
    it('should accept valid index names', () => {
      expect(isValidIndexName('idx_orders_customer_id')).toBe(true);
      expect(isValidIndexName('idx_order_items_product_name')).toBe(true);
    });

    it('should reject invalid index names', () => {
      expect(isValidIndexName('orders_pkey')).toBe(false);
      expect(isValidIndexName('DROP TABLE orders')).toBe(false);
    });
  });
});
