import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { analyzeBottlenecks } = require('../analyzers/bottleneckAnalyzer');
const { parsePlan } = require('../services/planParser');

describe('Bottleneck Analyzer', () => {
  it('should detect an expensive sequential scan', () => {
    const rawPlan = {
      'Node Type': 'Seq Scan',
      'Relation Name': 'orders',
      'Actual Total Time': 45.0,
      'Actual Rows': 20,
      'Actual Loops': 1,
      'Plan Rows': 20,
      'Filter': '(customer_id = 2500)',
      'Rows Removed by Filter': 99980
    };

    const parsed = parsePlan(rawPlan);
    const findings = analyzeBottlenecks(parsed, 45.0);

    const seqScanFinding = findings.find(f => f.title === 'Expensive sequential scan');
    expect(seqScanFinding).toBeDefined();
    expect(seqScanFinding.severity).toBe('high');
    expect(seqScanFinding.evidence.relationName).toBe('orders');
    expect(seqScanFinding.nodeId).toBe(parsed.id);
  });

  it('should detect a row estimate mismatch', () => {
    const rawPlan = {
      'Node Type': 'Seq Scan',
      'Relation Name': 'orders',
      'Actual Total Time': 5.0,
      'Actual Rows': 1000,
      'Actual Loops': 1,
      'Plan Rows': 1
    };

    const parsed = parsePlan(rawPlan);
    const findings = analyzeBottlenecks(parsed, 5.0);

    const mismatchFinding = findings.find(f => f.title === 'Row estimate mismatch');
    expect(mismatchFinding).toBeDefined();
    expect(mismatchFinding.evidence.ratio).toBeGreaterThanOrEqual(10);
  });

  it('should detect an expensive nested loop', () => {
    const rawPlan = {
      'Node Type': 'Nested Loop',
      'Actual Total Time': 100.0,
      'Actual Rows': 5000,
      'Actual Loops': 1,
      'Plan Rows': 5000,
      Plans: [
        {
          'Node Type': 'Seq Scan',
          'Relation Name': 'customers',
          'Actual Total Time': 1.0,
          'Actual Rows': 5000,
          'Actual Loops': 1,
          'Plan Rows': 5000
        },
        {
          'Node Type': 'Seq Scan',
          'Relation Name': 'orders',
          'Actual Total Time': 0.02,
          'Actual Rows': 1,
          'Actual Loops': 5000,
          'Plan Rows': 1
        }
      ]
    };

    const parsed = parsePlan(rawPlan);
    const findings = analyzeBottlenecks(parsed, 100.0);

    const nestedLoopFinding = findings.find(f => f.title === 'Expensive nested loop');
    expect(nestedLoopFinding).toBeDefined();
  });

  it('should detect temporary disk usage', () => {
    const rawPlan = {
      'Node Type': 'Sort',
      'Actual Total Time': 50.0,
      'Actual Rows': 100000,
      'Actual Loops': 1,
      'Plan Rows': 100000,
      'Sort Key': ['total_amount'],
      'Sort Method': 'external merge',
      'Sort Space Used': 50000,
      'Sort Space Type': 'Disk',
      'Temp Read Blocks': 500,
      'Temp Written Blocks': 500
    };

    const parsed = parsePlan(rawPlan);
    const findings = analyzeBottlenecks(parsed, 50.0);

    const tempFinding = findings.find(f => f.title === 'Temporary disk usage');
    expect(tempFinding).toBeDefined();
    expect(tempFinding.severity).toBe('high');
  });

  it('should not flag a small sequential scan', () => {
    const rawPlan = {
      'Node Type': 'Seq Scan',
      'Relation Name': 'tiny_table',
      'Actual Total Time': 0.01,
      'Actual Rows': 10,
      'Actual Loops': 1,
      'Plan Rows': 10,
      'Filter': '(id = 1)',
      'Rows Removed by Filter': 9
    };

    const parsed = parsePlan(rawPlan);
    const findings = analyzeBottlenecks(parsed, 0.01);

    const seqScanFinding = findings.find(f => f.title === 'Expensive sequential scan');
    expect(seqScanFinding).toBeUndefined();
  });

  it('should not flag a row mismatch when both are zero', () => {
    const rawPlan = {
      'Node Type': 'Result',
      'Actual Total Time': 0.001,
      'Actual Rows': 0,
      'Actual Loops': 1,
      'Plan Rows': 0
    };

    const parsed = parsePlan(rawPlan);
    const findings = analyzeBottlenecks(parsed, 0.001);

    const mismatchFinding = findings.find(f => f.title === 'Row estimate mismatch');
    expect(mismatchFinding).toBeUndefined();
  });
});
