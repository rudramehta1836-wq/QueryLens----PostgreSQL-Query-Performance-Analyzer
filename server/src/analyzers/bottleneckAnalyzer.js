/**
 * Rule-based bottleneck analyzer.
 * Examines parsed execution plan nodes and generates findings
 * about possible performance issues.
 *
 * All findings are suggestions, not guarantees.
 */

const { flattenPlan } = require('../services/planParser');

/**
 * Analyze a parsed plan tree for performance bottlenecks.
 *
 * @param {Object} parsedPlan - The root of the parsed plan tree
 * @param {number} totalExecutionTime - Total execution time in ms
 * @returns {Object[]} Array of findings
 */
function analyzeBottlenecks(parsedPlan, totalExecutionTime) {
  const findings = [];
  const allNodes = flattenPlan(parsedPlan);

  for (const node of allNodes) {
    checkExpensiveSeqScan(node, totalExecutionTime, findings);
    checkRowEstimateMismatch(node, findings);
    checkExpensiveNestedLoop(node, totalExecutionTime, findings);
    checkExpensiveSort(node, totalExecutionTime, findings);
    checkHighRowsRemovedByFilter(node, findings);
    checkTempDiskUsage(node, findings);
    checkRepeatedScans(node, findings);
  }

  return findings;
}

/**
 * Rule: Expensive Sequential Scan
 * Flags seq scans on large tables with filter conditions that remove many rows.
 */
function checkExpensiveSeqScan(node, totalExecutionTime, findings) {
  if (node.nodeType !== 'Seq Scan') return;

  const hasFilter = node.filter !== null;
  const actualRows = node.actualRows * (node.actualLoops || 1);
  const rowsRemoved = node.rowsRemovedByFilter * (node.actualLoops || 1);
  const totalRowsScanned = actualRows + rowsRemoved;
  const nodeTime = node.actualTotalTime * (node.actualLoops || 1);

  // Flag if: large table, has filter, removes many rows
  if (hasFilter && totalRowsScanned > 500 && rowsRemoved > actualRows * 2) {
    const timeFraction = totalExecutionTime > 0
      ? nodeTime / totalExecutionTime
      : 0;

    let severity = 'low';
    if (totalRowsScanned > 10000 || timeFraction > 0.5) severity = 'high';
    else if (totalRowsScanned > 1000 || timeFraction > 0.3) severity = 'medium';

    findings.push({
      severity,
      title: 'Expensive sequential scan',
      description: `The "${node.relationName || 'unknown'}" table was scanned sequentially ` +
        `(${totalRowsScanned.toLocaleString()} rows examined). ` +
        `A filter condition removed ${rowsRemoved.toLocaleString()} rows, ` +
        `returning only ${actualRows.toLocaleString()} rows. ` +
        `An index on the filtered column could reduce the rows examined.`,
      nodeId: node.id,
      evidence: {
        nodeType: node.nodeType,
        relationName: node.relationName,
        actualRows,
        rowsRemoved,
        totalRowsScanned,
        actualTime: Math.round(nodeTime * 100) / 100,
        filter: node.filter
      }
    });
  }
}

/**
 * Rule: Estimated vs Actual Row Mismatch
 * Flags when PostgreSQL's row estimates are far off from actual rows.
 */
function checkRowEstimateMismatch(node, findings) {
  const estimated = node.planRows || 0;
  const actual = node.actualRows || 0;

  if (estimated === 0 && actual === 0) return;

  const maxVal = Math.max(actual, estimated);
  const minVal = Math.max(1, Math.min(actual, estimated));
  const ratio = maxVal / minVal;

  if (ratio >= 10) {
    let severity = 'low';
    if (ratio >= 100) severity = 'high';
    else if (ratio >= 50) severity = 'medium';

    findings.push({
      severity,
      title: 'Row estimate mismatch',
      description: `The planner estimated ${estimated.toLocaleString()} rows for ` +
        `"${node.nodeType}" on "${node.relationName || 'subquery'}", ` +
        `but ${actual.toLocaleString()} rows were actually produced ` +
        `(${Math.round(ratio)}× difference). ` +
        `This may indicate stale statistics or uneven data distribution. ` +
        `Consider running ANALYZE on the affected table.`,
      nodeId: node.id,
      evidence: {
        nodeType: node.nodeType,
        relationName: node.relationName,
        estimatedRows: estimated,
        actualRows: actual,
        ratio: Math.round(ratio * 10) / 10
      }
    });
  }
}

/**
 * Rule: Expensive Nested Loop
 * Flags nested loops with many iterations processing many rows.
 */
function checkExpensiveNestedLoop(node, totalExecutionTime, findings) {
  if (node.nodeType !== 'Nested Loop') return;

  const loops = node.actualLoops || 1;
  const actualRows = node.actualRows * loops;
  const nodeTime = node.actualTotalTime * loops;
  const timeFraction = totalExecutionTime > 0 ? nodeTime / totalExecutionTime : 0;

  // Check if inner children have high loop counts
  const innerChild = node.children && node.children.length > 1
    ? node.children[1]
    : null;

  const innerLoops = innerChild ? (innerChild.actualLoops || 1) : 1;

  if (innerLoops > 100 && timeFraction > 0.3) {
    let severity = 'medium';
    if (innerLoops > 1000 || timeFraction > 0.7) severity = 'high';

    findings.push({
      severity,
      title: 'Expensive nested loop',
      description: `A nested loop join executed its inner side ${innerLoops.toLocaleString()} times, ` +
        `consuming ${Math.round(timeFraction * 100)}% of total execution time. ` +
        `Consider whether an index on the inner relation's join column ` +
        `or a different join strategy could help.`,
      nodeId: node.id,
      evidence: {
        nodeType: node.nodeType,
        innerLoops,
        actualRows,
        actualTime: Math.round(nodeTime * 100) / 100,
        timeFraction: Math.round(timeFraction * 100)
      }
    });
  }
}

/**
 * Rule: Expensive Sort
 * Flags sorts that use disk or process large numbers of rows.
 */
function checkExpensiveSort(node, totalExecutionTime, findings) {
  if (node.nodeType !== 'Sort') return;

  const actualRows = node.actualRows * (node.actualLoops || 1);
  const useDisk = node.sortSpaceType === 'Disk';
  const useExternalSort = node.sortMethod && node.sortMethod.toLowerCase().includes('external');
  const tempBlocks = node.buffers.tempRead + node.buffers.tempWritten;
  const nodeTime = node.actualTotalTime * (node.actualLoops || 1);

  if (useDisk || useExternalSort || tempBlocks > 0 || actualRows > 50000) {
    let severity = 'low';
    if (useDisk || useExternalSort || tempBlocks > 100) severity = 'high';
    else if (actualRows > 100000) severity = 'medium';

    findings.push({
      severity,
      title: 'Expensive sort operation',
      description: `A sort operation processed ${actualRows.toLocaleString()} rows` +
        `${useDisk ? ' using disk storage' : ''}` +
        `${tempBlocks > 0 ? ` (${tempBlocks} temp blocks)` : ''}. ` +
        `${node.sortMethod ? `Sort method: ${node.sortMethod}. ` : ''}` +
        `Consider adding an index that matches the sort order to avoid explicit sorting.`,
      nodeId: node.id,
      evidence: {
        nodeType: node.nodeType,
        sortMethod: node.sortMethod,
        sortSpaceUsed: node.sortSpaceUsed,
        sortSpaceType: node.sortSpaceType,
        actualRows,
        tempBlocks,
        actualTime: Math.round(nodeTime * 100) / 100
      }
    });
  }
}

/**
 * Rule: High Rows Removed by Filter
 * Flags when a scan reads many rows but returns very few.
 */
function checkHighRowsRemovedByFilter(node, findings) {
  const actualRows = node.actualRows * (node.actualLoops || 1);
  const rowsRemoved = node.rowsRemovedByFilter * (node.actualLoops || 1);

  if (rowsRemoved === 0 || actualRows === 0) return;

  const ratio = rowsRemoved / Math.max(1, actualRows);

  // Only flag if: removed > 1000 rows AND ratio is high AND not already flagged as seq scan
  if (ratio > 10 && rowsRemoved > 1000 && node.nodeType !== 'Seq Scan') {
    findings.push({
      severity: ratio > 100 ? 'high' : 'medium',
      title: 'High rows removed by filter',
      description: `"${node.nodeType}" on "${node.relationName || 'subquery'}" ` +
        `scanned ${(actualRows + rowsRemoved).toLocaleString()} rows ` +
        `but returned only ${actualRows.toLocaleString()} (${Math.round(ratio)}× more removed). ` +
        `A more selective index or filter may reduce unnecessary row processing.`,
      nodeId: node.id,
      evidence: {
        nodeType: node.nodeType,
        relationName: node.relationName,
        actualRows,
        rowsRemoved,
        ratio: Math.round(ratio * 10) / 10
      }
    });
  }
}

/**
 * Rule: Temporary Disk Usage
 * Flags any node that uses temporary disk blocks.
 */
function checkTempDiskUsage(node, findings) {
  const tempRead = node.buffers.tempRead || 0;
  const tempWritten = node.buffers.tempWritten || 0;

  if (tempRead === 0 && tempWritten === 0) return;

  findings.push({
    severity: (tempRead + tempWritten) >= 1000 ? 'high' : 'medium',
    title: 'Temporary disk usage',
    description: `"${node.nodeType}" used temporary disk storage ` +
      `(${tempRead} blocks read, ${tempWritten} blocks written). ` +
      `This may indicate insufficient work_mem. ` +
      `Consider increasing work_mem or restructuring the query.`,
    nodeId: node.id,
    evidence: {
      nodeType: node.nodeType,
      relationName: node.relationName,
      tempRead,
      tempWritten
    }
  });
}

/**
 * Rule: Repeated Scans
 * Flags nodes with high loop counts scanning the same relation repeatedly.
 */
function checkRepeatedScans(node, findings) {
  const loops = node.actualLoops || 1;

  if (loops <= 50) return;
  if (!node.relationName) return;

  // Only flag scan types
  const scanTypes = ['Seq Scan', 'Index Scan', 'Index Only Scan', 'Bitmap Heap Scan'];
  if (!scanTypes.includes(node.nodeType)) return;

  findings.push({
    severity: loops > 500 ? 'high' : 'medium',
    title: 'Repeated relation scan',
    description: `"${node.nodeType}" on "${node.relationName}" executed ` +
      `${loops.toLocaleString()} times. ` +
      `This repetition inside a loop may be a candidate for materialization ` +
      `or restructuring the join strategy.`,
    nodeId: node.id,
    evidence: {
      nodeType: node.nodeType,
      relationName: node.relationName,
      loops,
      actualRows: node.actualRows,
      actualTime: Math.round(node.actualTotalTime * 100) / 100
    }
  });
}

module.exports = { analyzeBottlenecks };
