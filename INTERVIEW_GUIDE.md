# QueryLens — Interview Guide

This guide prepares you to explain QueryLens in a technical interview. All answers reference features that are genuinely implemented in the codebase.

---

## 30-Second Introduction

> "QueryLens is a full-stack web application I built for analyzing PostgreSQL query performance. You enter a SQL query, and it runs EXPLAIN ANALYZE to get the actual execution plan. It then parses that plan into a visual tree, detects bottlenecks like sequential scans and row estimate mismatches, and recommends indexes. You can even test the recommendation by creating a demo index and comparing before-and-after performance. The whole thing runs in Docker with React on the frontend, Node.js on the backend, and PostgreSQL with 300,000 rows of sample data."

---

## 90-Second Detailed Explanation

> "The project solves a real problem — understanding why a query is slow. PostgreSQL has EXPLAIN ANALYZE, but its output is hard to read, especially in JSON format with nested plans.
>
> QueryLens takes that raw JSON plan, parses it recursively into a tree structure where each node has metrics like actual rows, estimated rows, execution time, and buffer usage. It then runs seven detection rules — things like expensive sequential scans where a filter removes 99% of rows, or situations where PostgreSQL estimated 10 rows but actually got 10,000.
>
> When it finds a sequential scan with a filter, the index advisor checks if a B-tree index exists on that column. If not, it recommends one. You can click 'Test Before vs After' — the server creates the index, runs ANALYZE, re-executes the query, and shows you the actual difference in execution time and scan type.
>
> Security was critical since this executes real SQL. I use AST-based validation with node-sql-parser to ensure only SELECT queries pass through, block 40+ dangerous functions, run everything in read-only transactions with a 5-second timeout, and use separate database roles. The index creation endpoint only accepts server-generated recommendation IDs — no arbitrary SQL from the browser.
>
> The stack is React with Vite, Express.js, PostgreSQL 16, all containerized in Docker Compose with health checks and persistent volumes."

---

## Problem Statement

Most developers encounter slow queries but struggle to understand PostgreSQL's execution plans. The raw EXPLAIN output is hard to interpret, especially for:
- Understanding which operations consume the most time
- Knowing whether an index would help
- Measuring the actual impact of adding an index

QueryLens makes this process visual, educational, and measurable.

---

## Why This Project Is Useful

1. **Educational** — Teaches how PostgreSQL executes queries internally
2. **Practical** — Demonstrates real index improvements on 100K+ rows
3. **Measurable** — Shows actual before-and-after timing differences
4. **Secure** — Demonstrates production-grade SQL safety practices
5. **Resume-worthy** — Shows full-stack skills with meaningful domain depth

---

## Architecture

```
Browser → React (Vite :5173)
       → HTTP /api/* proxied to Express (:5000)
       → Express validates SQL through AST parsing
       → Executes EXPLAIN ANALYZE via pg pool (read-only transaction)
       → Parses JSON plan recursively
       → Analyzes bottlenecks with 7 rule-based checks
       → Generates index recommendations
       → Returns structured response
       → React renders plan tree, findings, recommendations
       → Before-vs-after: server creates index via admin pool → re-executes
```

### Two Database Roles

- `querylens_app` — Read-only. Used for EXPLAIN ANALYZE. Cannot create indexes.
- `querylens_admin` — Can CREATE/DROP indexes and run ANALYZE. Used only for controlled before-vs-after testing.

---

## How EXPLAIN ANALYZE Works

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, VERBOSE, SETTINGS)
SELECT * FROM orders WHERE customer_id = 2500;
```

- `ANALYZE` — Actually executes the query (not just estimates)
- `BUFFERS` — Reports shared buffer hit/read counts
- `FORMAT JSON` — Returns structured JSON instead of text
- `VERBOSE` — Includes output column lists
- `SETTINGS` — Shows non-default planner settings

**Important**: EXPLAIN ANALYZE *executes* the query. This is why we run it inside a READ ONLY transaction and enforce a statement timeout.

---

## Why FORMAT JSON

- Text format is designed for human reading but hard to parse programmatically
- JSON format provides a structured tree that maps directly to PostgreSQL's plan node hierarchy
- Each node contains all metrics as key-value pairs
- Children are nested in a `Plans` array
- Parsing JSON is reliable; parsing text requires fragile regex

---

## Sequential Scan vs Index Scan

**Sequential Scan**: Reads every row in the table, then applies the filter. On a 100,000-row table filtering for 1 customer, it reads 100,000 rows and discards 99,980.

**Index Scan**: Uses a B-tree index to jump directly to matching rows. On the same query, it reads ~20 rows from the index and fetches only those from the table.

**When PostgreSQL chooses Seq Scan over Index Scan**:
- Table is small (a full scan is faster than index lookup + table fetch)
- Query returns a large fraction of the table (low selectivity)
- Statistics are stale (planner doesn't know the data distribution)
- No suitable index exists

---

## B-Tree Index Basics

A B-tree is a balanced tree data structure that maintains sorted data:
- Leaf nodes contain pointers to actual table rows
- Internal nodes contain separator keys for binary search
- PostgreSQL can traverse from root to leaf in O(log n) steps
- Works well for equality (`=`) and range (`<`, `>`, `BETWEEN`) queries
- Default index type in PostgreSQL

**Trade-offs**:
- Uses disk space (proportional to indexed column size × rows)
- Slows down INSERT and UPDATE (index must be updated)
- Needs periodic maintenance (VACUUM, REINDEX)

---

## Why PostgreSQL May Ignore an Index

1. **Low selectivity** — If the query returns >10-20% of rows, a sequential scan can be faster
2. **Small table** — Random I/O for index + table fetch is slower than sequential read for small tables
3. **Stale statistics** — The planner's cost estimates are based on pg_statistic; if stale, it may choose wrong
4. **Type mismatch** — The query's data type doesn't match the index column type
5. **Expression mismatch** — `WHERE lower(name) = 'test'` won't use an index on `name`
6. **Correlation** — If physical row order doesn't match index order, random I/O is expensive

---

## Estimated vs Actual Rows

PostgreSQL estimates rows before execution using `pg_statistic` (histograms, distinct values, null fractions).

When estimated and actual rows differ significantly (e.g., 10× or more), the planner may have chosen a suboptimal plan. Common causes:
- Stale statistics (run `ANALYZE` on the table)
- Correlated columns (planner assumes independence)
- Unusual data distribution
- Functions in WHERE clauses (planner can't estimate selectivity)

QueryLens calculates: `max(actual, estimated) / max(1, min(actual, estimated))` and flags ratios ≥ 10.

---

## Nested Loop vs Hash Join

**Nested Loop**: For each row in the outer table, scan the inner table. Efficient when the outer table is small and the inner table has an index. O(n × m) without an index.

**Hash Join**: Build a hash table from the smaller table, then probe it with each row from the larger table. Efficient for large tables without indexes. Requires memory proportional to the smaller table.

**Merge Join**: Sort both tables, then merge. Efficient when both inputs are already sorted or an index provides order.

QueryLens flags expensive nested loops where the inner side runs 100+ times, suggesting an index might help.

---

## Index Trade-offs

**Benefits**:
- Faster reads for selective queries
- Support for ORDER BY without explicit sorting
- Enable efficient joins (index nested loop)

**Costs**:
- Storage space on disk
- Slower INSERT operations (each insert must update the index)
- Slower UPDATE operations on indexed columns
- Maintenance overhead (VACUUM must clean dead index entries)
- Too many indexes can confuse the planner

---

## Security Precautions

1. **AST-based validation** — Parse SQL into an abstract syntax tree, don't rely on regex/string matching
2. **Single statement only** — Reject semicolon-separated queries
3. **SELECT-only** — Reject INSERT, UPDATE, DELETE, DROP, ALTER, etc.
4. **Function blocklist** — 40+ dangerous functions (file access, network, large objects)
5. **Read-only transactions** — `BEGIN TRANSACTION READ ONLY`
6. **Statement timeout** — 5-second limit prevents DoS
7. **Role separation** — Analysis uses a read-only DB user
8. **Server-controlled indexes** — No arbitrary CREATE INDEX from the client
9. **Safe identifier quoting** — Prevents SQL injection through table/column names
10. **No stack traces in production** — Centralized error handler sanitizes responses

---

## Main Technical Challenges

1. **Parsing node-sql-parser's AST** — Function names are nested as arrays of objects, not simple strings. Required debugging the actual AST structure to build correct detection.

2. **CJS/ESM compatibility** — The server uses CommonJS (Express ecosystem) but Vitest requires ESM. Solved by using `.mjs` test files with `createRequire`.

3. **Docker networking** — The frontend runs in the browser (not in Docker), so it needs to reach the backend at `localhost:5000`, not `server:5000`. Solved with Vite proxy configuration.

4. **Recursive plan parsing** — PostgreSQL plans can be arbitrarily deep with multiple child arrays. Required careful recursive traversal with stable ID generation.

5. **Before-vs-after reliability** — Timing varies between runs due to caching. Creating the index, running ANALYZE, and re-executing gives the most representative comparison.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Custom CSS tree instead of React Flow | Plan trees are naturally hierarchical; a library adds 100KB+ for what CSS handles well |
| Vitest instead of Jest | Aligns with the Vite ecosystem, faster startup |
| Two DB roles instead of one | Principle of least privilege — analysis can't modify schema |
| In-memory recommendation store | Simple, stateless across restarts; recommendations regenerate on each analysis |
| Rule-based analysis | Transparent, explainable, predictable — more suitable for a learning tool than ML/AI |
| Textarea instead of CodeMirror | Keeps bundle small; adds monospace styling and keyboard shortcuts |

---

## Limitations

- Rule-based, not a complete optimizer
- EXPLAIN ANALYZE executes the query — timing varies
- Recommendations are for demo tables only
- Only read-only queries supported
- No authentication system
- No support for multiple databases
- SQL parsing can't replace complete DB isolation

---

## Future Improvements

- Visual plan tree with React Flow
- Query comparison between versions
- pg_stat_statements integration
- Query rewriting suggestions
- Export as PDF
- Support for MySQL/MariaDB
- User authentication

---

## 25 Interview Questions & Answers

### 1. What does QueryLens do?
QueryLens analyzes PostgreSQL query performance. You enter a SELECT query, it runs EXPLAIN ANALYZE, parses the execution plan into a visual tree, detects bottlenecks, recommends indexes, and lets you test the recommendation's impact.

### 2. Why did you build this project?
To demonstrate full-stack development skills with real database internals — not just CRUD operations. It shows understanding of how databases execute queries and how to build secure, production-quality software.

### 3. What tech stack did you use?
React with Vite on the frontend, Node.js with Express on the backend, PostgreSQL 16 for the database, and Docker Compose for infrastructure. Tests use Vitest and Supertest.

### 4. How does EXPLAIN ANALYZE work?
It actually executes the query and records real metrics — actual rows, actual time, buffer usage. Unlike plain EXPLAIN, it shows what *really* happened, not just estimates.

### 5. Why use FORMAT JSON instead of text?
JSON provides a structured tree with all metrics as key-value pairs. Text format requires fragile regex parsing and loses structural information.

### 6. How do you ensure query safety?
Multi-layer approach: AST parsing with node-sql-parser, single-statement enforcement, SELECT-only validation, function blocklist (40+ functions), read-only transactions, 5-second timeout, separate DB roles, and server-controlled index creation.

### 7. What is a sequential scan?
PostgreSQL reads every row in the table from disk, then applies the WHERE filter. It's like reading every page of a book to find one paragraph.

### 8. What is a B-tree index?
A balanced tree structure that maintains sorted pointers to table rows. It allows O(log n) lookups instead of O(n) full table scans.

### 9. When would PostgreSQL ignore an index?
When the table is small, when the query returns too many rows (low selectivity), when statistics are stale, or when there's a type/expression mismatch.

### 10. How does your bottleneck detector work?
Seven rule-based checks examine each plan node. For example, the sequential scan rule flags nodes where the filter removes more than 2× the returned rows on tables with 500+ rows.

### 11. How do you recommend indexes?
I extract column names from filter and join conditions in plan nodes, verify the column exists via information_schema, check if an index already exists via pg_indexes, and skip tiny tables. The recommendation includes the CREATE INDEX SQL, a reason, and trade-off notes.

### 12. How does before-vs-after testing work?
The server stores recommendation data in memory. When the user clicks "Test", the server creates the index using the admin DB role, runs ANALYZE, re-executes the same EXPLAIN ANALYZE, and compares timing, scan type, rows processed, and buffer usage.

### 13. Why separate database roles?
Principle of least privilege. The analysis role (`querylens_app`) can only SELECT. The admin role (`querylens_admin`) can create/drop indexes. This prevents the analysis endpoint from modifying the schema.

### 14. How do you prevent SQL injection?
Three layers: AST-based parsing rejects non-SELECT statements, the function blocklist catches dangerous function calls, and all identifier quoting uses a validated pattern — no string concatenation of user input.

### 15. What is a nested loop join?
For each row from the outer table, PostgreSQL scans the inner table. With an index on the inner table's join column, this is efficient. Without one, it's O(n × m).

### 16. What is a hash join?
PostgreSQL builds a hash table from the smaller table, then probes it with each row from the larger table. It's efficient for large unsorted tables but requires memory.

### 17. What is the difference between estimated and actual rows?
Estimated rows come from pg_statistic (pre-execution). Actual rows are measured during execution. Large mismatches indicate stale statistics or unusual data distribution, which can cause the planner to choose suboptimal plans.

### 18. How do you handle query timeouts?
A 5-second `statement_timeout` is set in the PostgreSQL session. If exceeded, PostgreSQL cancels the query and returns error code 57014, which the server catches and returns as a user-friendly timeout message.

### 19. How is the plan tree rendered?
Recursively. Each PlanNode component renders its own metrics and then maps over its children array, rendering child PlanNodes with increased indentation. CSS creates the tree connector lines.

### 20. What design patterns did you use?
Separation of concerns (controllers → services → analyzers), centralized error handling, middleware pipeline (validation → guard → execution), and a custom hook pattern (useQueryAnalysis) for frontend state management.

### 21. How do you store query history?
Successful analyses are saved to the `query_analysis_history` table with the query text, timings, findings, recommendations, and full plan as JSONB. Old entries are automatically pruned to the configured maximum.

### 22. What would you improve?
Visual plan tree with React Flow, query comparison between versions, pg_stat_statements integration for long-term metrics, and user authentication for multi-tenant usage.

### 23. How does Docker Compose orchestrate the services?
Three services: PostgreSQL starts first with a health check (pg_isready). The backend waits for Postgres to be healthy before starting. The frontend starts after the backend. A persistent volume preserves database data across restarts.

### 24. What are the trade-offs of adding indexes?
Indexes speed up reads but slow down writes (INSERT, UPDATE must update the index). They consume disk space. Too many indexes can confuse the planner and increase maintenance overhead.

### 25. How did you handle the CJS/ESM compatibility issue?
The Express server uses CommonJS (require), but Vitest requires ESM (import). I created test files as `.mjs` with ESM imports for vitest and used `createRequire` from the `module` built-in to require the CJS source modules.
