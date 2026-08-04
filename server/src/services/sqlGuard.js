const { Parser } = require('node-sql-parser');
const { createError } = require('../middleware/errorHandler');

const parser = new Parser();

// Functions that must never be called through analysis queries
const DANGEROUS_FUNCTIONS = new Set([
  // File system access
  'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_ls_logdir',
  'pg_ls_waldir', 'pg_ls_archive_statusdir', 'pg_ls_tmpdir',
  'pg_stat_file',
  // Large object access
  'lo_import', 'lo_export', 'lo_get', 'lo_put', 'lo_from_bytea',
  'lo_create', 'lo_open', 'lo_close', 'lo_read', 'lo_write',
  'lo_lseek', 'lo_tell', 'lo_truncate', 'lo_unlink',
  // Network / extension access
  'dblink', 'dblink_exec', 'dblink_connect', 'dblink_send_query',
  'dblink_get_result', 'dblink_cancel_query', 'dblink_close',
  // Copy
  'copy_to', 'copy_from',
  // System / admin
  'pg_terminate_backend', 'pg_cancel_backend', 'pg_reload_conf',
  'pg_rotate_logfile', 'set_config', 'current_setting',
  'pg_advisory_lock', 'pg_advisory_unlock',
  'pg_sleep',
  // Execution
  'query_to_xml', 'query_to_json', 'query_to_jsonb',
  'ts_stat', 'xpath',
]);

// Statement types that are always forbidden
const FORBIDDEN_STATEMENT_TYPES = new Set([
  'insert', 'update', 'delete', 'drop', 'alter', 'truncate',
  'create', 'grant', 'revoke', 'call', 'do', 'vacuum', 'analyze',
  'copy', 'lock', 'comment', 'set', 'reset', 'discard',
  'listen', 'notify', 'unlisten', 'load', 'security_label',
  'reassign', 'cluster', 'checkpoint', 'reindex', 'refresh',
  'prepare', 'execute', 'deallocate', 'explain',
]);

/**
 * Validate a SQL query for safe read-only execution.
 * Uses layered approach: normalization → AST parsing → node walking.
 *
 * @param {string} rawSql - The user-provided SQL string
 * @returns {{ sql: string }} - The validated SQL
 * @throws Error with statusCode and errorCode on unsafe input
 */
function validateQuery(rawSql) {
  if (!rawSql || typeof rawSql !== 'string') {
    throw createError('Query is required.', 400, 'MISSING_QUERY');
  }

  const trimmed = rawSql.trim();
  if (trimmed.length === 0) {
    throw createError('Query is required.', 400, 'MISSING_QUERY');
  }

  if (trimmed.length > 5000) {
    throw createError('Query is too long (max 5000 characters).', 400, 'QUERY_TOO_LONG');
  }

  // Layer 1: Quick string-level checks for obviously dangerous patterns
  const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase();

  // Check for multiple statements via semicolons (outside of strings)
  if (containsMultipleStatements(trimmed)) {
    throw createError(
      'Only one SQL statement is allowed.',
      400, 'MULTIPLE_STATEMENTS'
    );
  }

  // Layer 2: Parse into AST
  let ast;
  try {
    ast = parser.astify(trimmed, { database: 'PostgresQL' });
  } catch (parseErr) {
    throw createError(
      'Failed to parse SQL query. Please check syntax.',
      400, 'PARSE_ERROR'
    );
  }

  // Layer 3: Ensure exactly one statement
  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    throw createError(
      'Only one SQL statement is allowed.',
      400, 'MULTIPLE_STATEMENTS'
    );
  }

  const stmt = statements[0];

  // Layer 4: Confirm it is a SELECT (or WITH ... SELECT)
  if (!stmt || !stmt.type) {
    throw createError(
      'Unable to determine statement type.',
      400, 'UNKNOWN_STATEMENT'
    );
  }

  const stmtType = stmt.type.toLowerCase();
  if (stmtType !== 'select') {
    if (FORBIDDEN_STATEMENT_TYPES.has(stmtType)) {
      throw createError(
        `${stmtType.toUpperCase()} statements are not allowed. Only SELECT queries are permitted.`,
        400, 'UNSAFE_QUERY'
      );
    }
    throw createError(
      'Only SELECT queries are allowed.',
      400, 'UNSAFE_QUERY'
    );
  }

  // Layer 5: Walk the AST for unsafe constructs
  walkAst(stmt);

  // If CTE (WITH clause), verify each CTE is also a SELECT
  if (stmt.with) {
    const ctes = Array.isArray(stmt.with) ? stmt.with : [stmt.with];
    for (const cte of ctes) {
      if (cte.stmt) {
        const cteStmt = cte.stmt.ast || cte.stmt;
        if (cteStmt.type && cteStmt.type.toLowerCase() !== 'select') {
          throw createError(
            'Only SELECT statements are allowed in WITH clauses.',
            400, 'UNSAFE_QUERY'
          );
        }
        walkAst(cteStmt);
      }
    }
  }

  return { sql: trimmed };
}

/**
 * Detect multiple semicolon-separated statements (outside string literals).
 */
function containsMultipleStatements(sql) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  let semicolonCount = 0;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (ch === ';' && !inSingleQuote && !inDoubleQuote) {
      semicolonCount++;
      if (semicolonCount > 1) return true;
      // Check if there's non-whitespace after the semicolon
      const after = sql.substring(i + 1).trim();
      if (after.length > 0) return true;
    }
  }

  return false;
}

/**
 * Recursively walk the AST to find dangerous constructs.
 */
function walkAst(node) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) {
      walkAst(item);
    }
    return;
  }

  // Check for function calls
  if (node.type === 'function' || node.type === 'aggr_func') {
    const funcName = extractFunctionName(node);
    if (funcName && DANGEROUS_FUNCTIONS.has(funcName.toLowerCase())) {
      throw createError(
        `Function "${funcName}" is not allowed.`,
        400, 'UNSAFE_FUNCTION'
      );
    }
  }

  // Check for subqueries that might be non-SELECT
  if (node.ast && node.ast.type) {
    const subType = node.ast.type.toLowerCase();
    if (subType !== 'select') {
      throw createError(
        'Only SELECT subqueries are allowed.',
        400, 'UNSAFE_QUERY'
      );
    }
  }

  // Recurse into all object properties
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue; // avoid circular refs
    walkAst(node[key]);
  }
}

/**
 * Extract function name from AST node.
 */
function extractFunctionName(node) {
  if (!node) return null;

  if (node.name) {
    if (typeof node.name === 'string') return node.name;
    if (node.name.name) {
      if (Array.isArray(node.name.name)) {
        // node-sql-parser represents function names as arrays of
        // { type: 'default', value: 'function_name' } objects
        return node.name.name.map(part => {
          if (typeof part === 'string') return part;
          if (part && part.value) return part.value;
          return String(part);
        }).join('.');
      }
      if (typeof node.name.name === 'string') return node.name.name;
      if (node.name.name.value) return node.name.name.value;
      return String(node.name.name);
    }
  }

  return null;
}

module.exports = { validateQuery, DANGEROUS_FUNCTIONS };
