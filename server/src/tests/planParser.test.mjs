import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parsePlan, flattenPlan } = require('../services/planParser');

describe('Plan Parser', () => {
  describe('parsePlan', () => {
    it('should parse a single Seq Scan node', () => {
      const rawPlan = {
        'Node Type': 'Seq Scan',
        'Relation Name': 'orders',
        'Alias': 'orders',
        'Startup Cost': 0.00,
        'Total Cost': 1800.00,
        'Plan Rows': 100000,
        'Plan Width': 48,
        'Actual Startup Time': 0.01,
        'Actual Total Time': 42.7,
        'Actual Rows': 100000,
        'Actual Loops': 1,
        'Filter': '(customer_id = 2500)',
        'Rows Removed by Filter': 99980,
        'Shared Hit Blocks': 300,
        'Shared Read Blocks': 500
      };

      const result = parsePlan(rawPlan);

      expect(result.id).toBe('node-1');
      expect(result.nodeType).toBe('Seq Scan');
      expect(result.relationName).toBe('orders');
      expect(result.actualRows).toBe(100000);
      expect(result.planRows).toBe(100000);
      expect(result.totalCost).toBe(1800);
      expect(result.filter).toBe('(customer_id = 2500)');
      expect(result.rowsRemovedByFilter).toBe(99980);
      expect(result.buffers.sharedHit).toBe(300);
      expect(result.buffers.sharedRead).toBe(500);
      expect(result.children).toEqual([]);
    });

    it('should parse nested child plans', () => {
      const rawPlan = {
        'Node Type': 'Nested Loop',
        'Actual Rows': 20,
        'Actual Total Time': 5.0,
        'Actual Loops': 1,
        Plans: [
          {
            'Node Type': 'Seq Scan',
            'Relation Name': 'customers',
            'Actual Rows': 1,
            'Actual Total Time': 0.5,
            'Actual Loops': 1
          },
          {
            'Node Type': 'Seq Scan',
            'Relation Name': 'orders',
            'Actual Rows': 20,
            'Actual Total Time': 4.5,
            'Actual Loops': 1
          }
        ]
      };

      const result = parsePlan(rawPlan);

      expect(result.nodeType).toBe('Nested Loop');
      expect(result.children).toHaveLength(2);
      expect(result.children[0].nodeType).toBe('Seq Scan');
      expect(result.children[0].relationName).toBe('customers');
      expect(result.children[1].nodeType).toBe('Seq Scan');
      expect(result.children[1].relationName).toBe('orders');
    });

    it('should generate stable sequential IDs', () => {
      const rawPlan = {
        'Node Type': 'Hash Join',
        Plans: [
          {
            'Node Type': 'Seq Scan',
            'Relation Name': 'orders'
          },
          {
            'Node Type': 'Hash',
            Plans: [
              {
                'Node Type': 'Seq Scan',
                'Relation Name': 'customers'
              }
            ]
          }
        ]
      };

      const result = parsePlan(rawPlan);

      expect(result.id).toBe('node-1');
      expect(result.children[0].id).toBe('node-2');
      expect(result.children[1].id).toBe('node-3');
      expect(result.children[1].children[0].id).toBe('node-4');
    });

    it('should handle missing optional fields gracefully', () => {
      const rawPlan = {
        'Node Type': 'Result'
      };

      const result = parsePlan(rawPlan);

      expect(result.nodeType).toBe('Result');
      expect(result.relationName).toBeNull();
      expect(result.filter).toBeNull();
      expect(result.indexName).toBeNull();
      expect(result.actualRows).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.buffers.sharedHit).toBe(0);
      expect(result.children).toEqual([]);
    });

    it('should extract buffer information', () => {
      const rawPlan = {
        'Node Type': 'Seq Scan',
        'Shared Hit Blocks': 100,
        'Shared Read Blocks': 200,
        'Shared Dirtied Blocks': 5,
        'Shared Written Blocks': 3,
        'Temp Read Blocks': 50,
        'Temp Written Blocks': 50
      };

      const result = parsePlan(rawPlan);

      expect(result.buffers.sharedHit).toBe(100);
      expect(result.buffers.sharedRead).toBe(200);
      expect(result.buffers.sharedDirtied).toBe(5);
      expect(result.buffers.sharedWritten).toBe(3);
      expect(result.buffers.tempRead).toBe(50);
      expect(result.buffers.tempWritten).toBe(50);
    });

    it('should handle sort information', () => {
      const rawPlan = {
        'Node Type': 'Sort',
        'Sort Key': ['total_amount DESC'],
        'Sort Method': 'quicksort',
        'Sort Space Used': 25,
        'Sort Space Type': 'Memory'
      };

      const result = parsePlan(rawPlan);

      expect(result.sortKey).toEqual(['total_amount DESC']);
      expect(result.sortMethod).toBe('quicksort');
      expect(result.sortSpaceUsed).toBe(25);
      expect(result.sortSpaceType).toBe('Memory');
    });
  });

  describe('flattenPlan', () => {
    it('should flatten a nested plan into an array', () => {
      const rawPlan = {
        'Node Type': 'Nested Loop',
        Plans: [
          { 'Node Type': 'Index Scan', 'Relation Name': 'customers' },
          { 'Node Type': 'Seq Scan', 'Relation Name': 'orders' }
        ]
      };

      const parsed = parsePlan(rawPlan);
      const flat = flattenPlan(parsed);

      expect(flat).toHaveLength(3);
      expect(flat[0].nodeType).toBe('Nested Loop');
      expect(flat[1].nodeType).toBe('Index Scan');
      expect(flat[2].nodeType).toBe('Seq Scan');
    });

    it('should handle null input', () => {
      expect(flattenPlan(null)).toEqual([]);
    });
  });
});
