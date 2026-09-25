/**
 * Rule-based index advisor.
 * Generates index recommendations from execution plan analysis.
 *
 * Recommendations are suggestions, not guarantees.
 * PostgreSQL may still choose not to use a recommended index.
 */

const { flattenPlan } = require('../services/planParser');
const { getAppPool } = require('../config/database');
const { quoteIdentifier } = require('../utils/identifiers');

/**
 * Generate index recommendations based on plan analysis and findings.
 *
 * @param {Object} parsedPlan - The parsed plan tree
 * @param {Object[]} findings - Bottleneck findings
 * @param {string} sql - The original query (for context)
 * @returns {Promise<Object[]>} Array of index recommendations
 */
async function generateRecommendations(parsedPlan, findings, sql) {
  const recommendations = [];
  const allNodes = flattenPlan(parsedPlan);
  const seenIndexes = new Set(); // track duplicates

  // Get existing indexes from the database
  const existingIndexes = await getExistingIndexes();

  for (const node of allNodes) {
    // Only consider seq scans with filter conditions
    if (node.nodeType === 'Seq Scan' && node.filter) {
      // Selectivity check: skip if the filter removes fewer rows than it keeps
      const actualRows = node.actualRows * (node.actualLoops || 1);
      const rowsRemoved = node.rowsRemovedByFilter * (node.actualLoops || 1);
      const totalScanned = actualRows + rowsRemoved;
      
      if (totalScanned > 0 && rowsRemoved < actualRows) {
        continue;
      }

      const columns = extractColumnsFromCondition(node.filter);
      const tableName = node.relationName;

      if (!tableName || columns.length === 0) continue;

      // Check table size - skip tiny tables
      const tableSize = await getTableRowCount(tableName);
      if (tableSize < 100) continue;

      for (const column of columns) {
        // Verify column exists
        const columnExists = await checkColumnExists(tableName, column);
        if (!columnExists) continue;

        // Check for existing index
        const indexKey = `${tableName}.${column}`;
        if (seenIndexes.has(indexKey)) continue;
        if (hasExistingIndex(existingIndexes, tableName, [column])) continue;

        seenIndexes.add(indexKey);

        const indexName = generateIndexName(tableName, [column]);
        const quotedTable = quoteIdentifier(tableName);
        const quotedColumn = quoteIdentifier(column);
        const quotedIndexName = quoteIdentifier(indexName);

        recommendations.push({
          id: `rec-${recommendations.length + 1}`,
          table: tableName,
          columns: [column],
          indexName,
          sql: `CREATE INDEX ${quotedIndexName} ON ${quotedTable}(${quotedColumn});`,
          reason: `The query filters "${tableName}" by "${column}" and currently performs a ` +
            `sequential scan. An index could allow PostgreSQL to locate matching rows ` +
            `directly instead of scanning the entire table.`,
          confidence: 'high',
          tradeOff: 'This index uses additional storage space and can slightly slow ' +
            'INSERT and UPDATE operations on this table.'
        });
      }
    }

    // Consider Index Scans with high rows removed by filter (needs composite index)
    const indexScanTypes = ['Index Scan', 'Bitmap Heap Scan'];
    if (indexScanTypes.includes(node.nodeType) && node.filter) {
      const actualRows = node.actualRows * (node.actualLoops || 1);
      const rowsRemoved = node.rowsRemovedByFilter * (node.actualLoops || 1);
      
      // If it removed > 10x more rows than it returned, and > 1000 rows were removed
      if (actualRows > 0 && rowsRemoved > actualRows * 10 && rowsRemoved > 1000) {
        const filterColumns = extractColumnsFromCondition(node.filter);
        const indexCondColumns = extractColumnsFromCondition(node.indexCondition || '');
        const tableName = node.relationName;
        
        if (tableName && filterColumns.length > 0) {
          // Combine existing indexed columns and the new filter columns
          const compositeColumns = [...new Set([...indexCondColumns, ...filterColumns])];
          
          if (compositeColumns.length > 1) { // Ensure it's actually composite
            let allColumnsExist = true;
            for (const col of compositeColumns) {
              if (!(await checkColumnExists(tableName, col))) {
                allColumnsExist = false;
                break;
              }
            }
            
            if (allColumnsExist && !hasExistingIndex(existingIndexes, tableName, compositeColumns)) {
              const indexKey = `${tableName}.${compositeColumns.join('_')}`;
              if (!seenIndexes.has(indexKey)) {
                seenIndexes.add(indexKey);
                
                const indexName = generateIndexName(tableName, compositeColumns);
                const quotedTable = quoteIdentifier(tableName);
                const quotedColumns = compositeColumns.map(quoteIdentifier).join(', ');
                const quotedIndexName = quoteIdentifier(indexName);
                
                recommendations.push({
                  id: `rec-${recommendations.length + 1}`,
                  table: tableName,
                  columns: compositeColumns,
                  indexName,
                  sql: `CREATE INDEX ${quotedIndexName} ON ${quotedTable}(${quotedColumns});`,
                  reason: `The query uses an index on "${tableName}" but still filters out ${rowsRemoved.toLocaleString()} rows after fetching them. A composite index covering all filter conditions can eliminate this overhead.`,
                  confidence: 'high',
                  tradeOff: 'Composite indexes use more storage and must be updated when any of the included columns change.'
                });
              }
            }
          }
        }
      }
    }

    // Consider join conditions — Nested Loops without index
    if (node.nodeType === 'Nested Loop' && node.children) {
      for (const child of node.children) {
        if (child.nodeType === 'Seq Scan' && child.filter) {
          // Already handled above
        }
        if (child.nodeType === 'Seq Scan' && !child.filter && child.relationName) {
          // Look at parent's join condition
          const joinCond = node.hashCondition || node.joinFilter || node.mergeCondition;
          if (joinCond) {
            const columns = extractColumnsFromCondition(joinCond);
            const tableName = child.relationName;

            for (const column of columns) {
              const indexKey = `${tableName}.${column}`;
              if (seenIndexes.has(indexKey)) continue;

              const columnExists = await checkColumnExists(tableName, column);
              if (!columnExists) continue;

              if (hasExistingIndex(existingIndexes, tableName, [column])) continue;

              seenIndexes.add(indexKey);

              const indexName = generateIndexName(tableName, [column]);
              const quotedTable = quoteIdentifier(tableName);
              const quotedColumn = quoteIdentifier(column);
              const quotedIndexName = quoteIdentifier(indexName);

              recommendations.push({
                id: `rec-${recommendations.length + 1}`,
                table: tableName,
                columns: [column],
                indexName,
                sql: `CREATE INDEX ${quotedIndexName} ON ${quotedTable}(${quotedColumn});`,
                reason: `The "${tableName}" table is used in a join and currently requires a ` +
                  `sequential scan. An index on "${column}" could speed up the join.`,
                confidence: 'medium',
                tradeOff: 'This index uses additional storage space and can slightly slow ' +
                  'INSERT and UPDATE operations on this table.'
              });
            }
          }
        }
      }
    }

    // Consider Hash Join with seq scan on inner
    if (node.nodeType === 'Hash Join' || node.nodeType === 'Merge Join') {
      const condition = node.hashCondition || node.mergeCondition;
      if (condition && node.children) {
        for (const child of node.children) {
          if (child.nodeType === 'Seq Scan' && child.relationName) {
            const tableName = child.relationName;
            const columns = extractColumnsForTable(condition, tableName);

            for (const column of columns) {
              const indexKey = `${tableName}.${column}`;
              if (seenIndexes.has(indexKey)) continue;

              const columnExists = await checkColumnExists(tableName, column);
              if (!columnExists) continue;

              if (hasExistingIndex(existingIndexes, tableName, [column])) continue;

              const tableSize = await getTableRowCount(tableName);
              if (tableSize < 100) continue;

              seenIndexes.add(indexKey);

              const indexName = generateIndexName(tableName, [column]);
              const quotedTable = quoteIdentifier(tableName);
              const quotedColumn = quoteIdentifier(column);
              const quotedIndexName = quoteIdentifier(indexName);

              recommendations.push({
                id: `rec-${recommendations.length + 1}`,
                table: tableName,
                columns: [column],
                indexName,
                sql: `CREATE INDEX ${quotedIndexName} ON ${quotedTable}(${quotedColumn});`,
                reason: `A join on "${tableName}" uses "${column}" and currently requires ` +
                  `scanning the full table. An index may help PostgreSQL use a more efficient join strategy.`,
                confidence: 'medium',
                tradeOff: 'This index uses additional storage space and can slightly slow ' +
                  'INSERT and UPDATE operations on this table.'
              });
            }
          }
        }
      }
    }
  }

  return recommendations;
}

/**
 * Extract column names from a PostgreSQL filter/condition string.
 * E.g., "(customer_id = 2500)" → ["customer_id"]
 */
function extractColumnsFromCondition(condition) {
  if (!condition) return [];

  const columns = [];
  // Match patterns like: column_name = value, column_name = 'value'
  // PostgreSQL formats conditions as: (column_name = value)
  const patterns = [
    /\(([a-zA-Z_][a-zA-Z0-9_]*)\s*[=<>!]+/g,
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|<>|!=|>=|<=|>|<|~~|!~~|IS)\s/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(condition)) !== null) {
      const col = match[1].toLowerCase();
      // Skip known non-column words
      if (!isReservedWord(col) && !columns.includes(col)) {
        columns.push(col);
      }
    }
  }

  return columns;
}

/**
 * Extract columns for a specific table from a join condition.
 * E.g., "(c.id = o.customer_id)" with table "orders" → ["customer_id"]
 */
function extractColumnsForTable(condition, tableName) {
  if (!condition) return [];

  const columns = [];
  // Match patterns like: alias.column_name
  const pattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;

  while ((match = pattern.exec(condition)) !== null) {
    const col = match[2].toLowerCase();
    if (!columns.includes(col) && !isReservedWord(col)) {
      columns.push(col);
    }
  }

  return columns;
}

/**
 * Check if a word is a SQL reserved word or known value.
 */
function isReservedWord(word) {
  const reserved = new Set([
    'null', 'true', 'false', 'and', 'or', 'not', 'in', 'any', 'all',
    'exists', 'between', 'like', 'ilike', 'is', 'case', 'when', 'then',
    'else', 'end', 'select', 'from', 'where', 'join', 'on', 'as',
    'order', 'by', 'group', 'having', 'limit', 'offset', 'union',
    'intersect', 'except', 'distinct', 'asc', 'desc',
  ]);
  return reserved.has(word.toLowerCase());
}

/**
 * Get all existing indexes from the database.
 */
async function getExistingIndexes() {
  try {
    const pool = getAppPool();
    const result = await pool.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    return result.rows;
  } catch (err) {
    console.error('Failed to fetch existing indexes:', err.message);
    return [];
  }
}

/**
 * Check if an index already covers the given columns on a table.
 */
function hasExistingIndex(indexes, tableName, columns) {
  for (const idx of indexes) {
    if (idx.tablename !== tableName) continue;

    // Check if indexdef contains all the columns
    const def = idx.indexdef.toLowerCase();
    const allColumnsIndexed = columns.every(col =>
      def.includes(col.toLowerCase())
    );

    if (allColumnsIndexed) return true;
  }
  return false;
}

/**
 * Get approximate row count for a table.
 */
async function getTableRowCount(tableName) {
  try {
    const pool = getAppPool();
    const result = await pool.query(`
      SELECT reltuples::bigint AS estimate
      FROM pg_class
      WHERE relname = $1
    `, [tableName]);

    if (result.rows.length > 0) {
      return parseInt(result.rows[0].estimate, 10) || 0;
    }
    return 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Check if a column exists in a table.
 */
async function checkColumnExists(tableName, columnName) {
  try {
    const pool = getAppPool();
    const result = await pool.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    `, [tableName, columnName]);
    return result.rows.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Generate a consistent index name.
 */
function generateIndexName(tableName, columns) {
  return `idx_${tableName}_${columns.join('_')}`;
}

module.exports = {
  generateRecommendations,
  extractColumnsFromCondition,
  extractColumnsForTable,
  hasExistingIndex,
  generateIndexName
};
