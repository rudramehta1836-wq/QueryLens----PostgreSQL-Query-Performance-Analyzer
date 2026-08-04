# QueryLens — SQL Query Performance Analyzer & Index Advisor

> Analyze PostgreSQL query performance, visualize execution plans as recursive trees, detect bottlenecks, and get index recommendations with controlled before-vs-after benchmarking.

![React](https://img.shields.io/badge/React-18-blue) ![Node.js](https://img.shields.io/badge/Node.js-20-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Docker](https://img.shields.io/badge/Docker-Compose-blue)

---

## Features

- **Query Analysis** — Execute `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on safe read-only queries
- **Execution Plan Tree** — Recursive visualization of PostgreSQL plan nodes with expand/collapse
- **Bottleneck Detection** — Rule-based analysis of sequential scans, row estimate mismatches, expensive joins, sorts, and temp disk usage
- **Index Recommendations** — Smart suggestions with confidence levels and trade-off explanations
- **Before vs After Testing** — Create demo indexes and measure actual performance improvement
- **Query History** — Persistent storage of analysis results with pagination
- **Security** — Multi-layer SQL validation (AST parsing, function blocklist, read-only transactions, statement timeouts)
- **Sample Database** — 300K+ rows of realistic e-commerce data designed to demonstrate performance issues

---

## Screenshots

> Run the application locally and capture screenshots for your portfolio.

| SQL Editor | Execution Plan | Findings & Recommendations |
|:---:|:---:|:---:|
| *Enter query and analyse* | *Recursive plan tree* | *Bottleneck detection* |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Axios, Plain CSS |
| Backend | Node.js 20, Express.js, pg, node-sql-parser, Zod |
| Database | PostgreSQL 16 |
| Testing | Vitest, Supertest |
| Infrastructure | Docker, Docker Compose |

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                  │     │                  │     │                  │
│   React Client   │────▶│  Express Server  │────▶│   PostgreSQL 16  │
│   (Vite :5173)   │     │    (:5000)       │     │    (:5432)       │
│                  │◀────│                  │◀────│                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                         │ SQL Guard        │     │ querylens_app    │
                         │ Plan Parser      │     │ (read-only)      │
                         │ Bottleneck Analyzer    │ querylens_admin   │
                         │ Index Advisor    │     │ (index mgmt)     │
                         │ Index Manager    │     │                  │
                         └──────────────────┘     └──────────────────┘
```

### Request Flow

1. User enters a SQL query in the frontend
2. Frontend sends `POST /api/analyse` to the backend
3. Backend validates the query through the SQL Guard (AST parsing + function blocklist)
4. Backend executes `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, VERBOSE, SETTINGS)` in a read-only transaction
5. Plan Parser converts the JSON result into a frontend-friendly tree
6. Bottleneck Analyzer examines nodes for performance issues
7. Index Advisor generates recommendations based on sequential scans and filter conditions
8. Response is returned with plan, findings, and recommendations
9. Frontend renders the execution plan tree, findings, and recommendations
10. User can test recommendations with before-vs-after benchmarking

---

## Folder Structure

```
querylens/
├── client/                         # React frontend
│   ├── src/
│   │   ├── api/queryApi.js         # Axios API client
│   │   ├── components/             # 15 React components
│   │   ├── hooks/useQueryAnalysis.js
│   │   ├── styles/index.css        # CSS design system
│   │   ├── utils/formatters.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
├── server/                         # Express backend
│   ├── src/
│   │   ├── analyzers/
│   │   │   ├── bottleneckAnalyzer.js
│   │   │   └── indexAdvisor.js
│   │   ├── config/database.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── sqlGuard.js
│   │   │   ├── queryExecutor.js
│   │   │   ├── planParser.js
│   │   │   ├── indexManager.js
│   │   │   └── historyService.js
│   │   ├── tests/                  # 62 tests
│   │   ├── utils/identifiers.js
│   │   └── app.js
│   ├── Dockerfile
│   ├── package.json
│   └── vitest.config.js
├── database/
│   ├── init.sql                    # Schema + roles
│   ├── seed.sql                    # 300K+ rows
│   └── README.md
├── docker-compose.yml
├── start-querylens.bat
├── stop-querylens.bat
├── INTERVIEW_GUIDE.md
└── README.md
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (includes Docker Compose)
- OR Node.js 20+ and PostgreSQL 16+ for local development

---

## Quick Start — Docker (Recommended)

```bash
# Clone and start
cd querylens
docker compose up --build
```

Or on Windows, double-click `start-querylens.bat`.

Wait for PostgreSQL seeding to complete (about 30 seconds for 300K rows), then open:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |
| Health Check | http://localhost:5000/api/health |

### Stop

```bash
docker compose down
```

To remove the database volume:

```bash
docker compose down -v
```

---

## Local Development (Without Docker)

### 1. Database Setup

```bash
# Start PostgreSQL and create database
createdb querylens
psql -d querylens -f database/init.sql
psql -d querylens -f database/seed.sql
```

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env: set DATABASE_HOST=localhost
npm install
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

---

## Environment Variables

See `server/.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `DATABASE_HOST` | `postgres` | PostgreSQL host |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_NAME` | `querylens` | Database name |
| `DATABASE_USER` | `querylens_app` | Read-only user |
| `DATABASE_PASSWORD` | `querylens_password` | App user password |
| `DATABASE_ADMIN_USER` | `querylens_admin` | Admin user for index ops |
| `DATABASE_ADMIN_PASSWORD` | `querylens_admin_password` | Admin password |
| `QUERY_TIMEOUT_MS` | `5000` | Query statement timeout |
| `MAX_HISTORY_ITEMS` | `100` | Max history entries |

---

## Database Schema

| Table | Rows | Purpose |
|-------|------|---------|
| `customers` | 5,000 | Customer data |
| `orders` | 100,000 | Order records |
| `order_items` | 200,000 | Order line items |
| `query_analysis_history` | Dynamic | Analysis results |

**Intentional design**: Filter columns (`customer_id`, `shipping_city`, `status`, `product_name`, `email`) are left **unindexed** to demonstrate sequential scans.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with DB status |
| `GET` | `/api/examples` | Sample queries |
| `POST` | `/api/analyse` | Analyse a SQL query |
| `POST` | `/api/recommendations/:id/test` | Before-vs-after test |
| `DELETE` | `/api/demo-indexes` | Remove all demo indexes |
| `GET` | `/api/history` | Paginated history |
| `GET` | `/api/history/:id` | Single history item |
| `DELETE` | `/api/history/:id` | Delete history item |

### Response Format

```json
{
  "success": true,
  "data": { },
  "error": null
}
```

---

## Example Usage

1. Select "Customer order lookup" from the dropdown
2. Click **Analyse Query**
3. Review the Execution Summary (time, cost, rows)
4. Explore the Plan Tree — click nodes to expand details
5. Read Findings — "Expensive sequential scan" flagged
6. Review Recommendation — "Create index on orders(customer_id)"
7. Click **Test Before vs After** — see measured improvement
8. Check History — previous analyses are saved

---

## Security Measures

1. **AST Parsing** — Queries parsed via `node-sql-parser`, not just string matching
2. **Statement Type Validation** — Only `SELECT` and `WITH ... SELECT` allowed
3. **Function Blocklist** — 40+ dangerous functions blocked (`pg_read_file`, `dblink`, `lo_import`, etc.)
4. **Read-Only Transactions** — `BEGIN TRANSACTION READ ONLY` for analysis
5. **Statement Timeout** — 5-second timeout prevents long-running queries
6. **Database Roles** — Separate `querylens_app` (read-only) and `querylens_admin` (index ops)
7. **Server-Side Index Control** — Indexes created from server-stored recommendations, not client SQL
8. **Identifier Quoting** — Safe quoting prevents SQL injection through identifiers
9. **No Arbitrary SQL** — Index operations accept only server-generated recommendation IDs

---

## Query Analysis Logic

### Bottleneck Detection Rules

| Rule | Severity | Trigger |
|------|----------|---------|
| Expensive Sequential Scan | High | Large table + filter + many rows removed |
| Row Estimate Mismatch | Medium–High | Estimated/actual ratio > 10× |
| Expensive Nested Loop | Medium–High | Inner side runs 100+ times |
| Expensive Sort | Low–High | Disk sort or 50K+ rows |
| Temporary Disk Usage | Medium–High | Temp blocks read/written |
| High Rows Removed | Medium–High | 10× more removed than returned |
| Repeated Scans | Medium–High | 50+ loops on same relation |

### Index Recommendation Logic

1. Identify sequential scans with filter conditions
2. Extract column names from filter/join conditions
3. Verify column exists in `information_schema.columns`
4. Check for existing indexes via `pg_indexes`
5. Skip tiny tables (< 100 rows)
6. Generate `CREATE INDEX` with safe identifier quoting
7. Explain the recommendation reason and trade-offs

---

## Testing

```bash
cd server
npm test
```

**62 tests** across 5 test suites:

| Suite | Tests | Coverage |
|-------|-------|----------|
| SQL Guard | 27 | Valid queries, rejected statements, comment injection, dangerous functions, edge cases |
| Plan Parser | 8 | Single nodes, nested plans, stable IDs, missing fields, buffers, sorts |
| Bottleneck Analyzer | 6 | Seq scan, row mismatch, nested loop, temp disk, false positive avoidance |
| Index Advisor | 14 | Column extraction, existing index detection, name generation, safe quoting |
| API Endpoints | 7 | Health, examples, validation, rejection, 404 |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Port already in use | Change `PORT` in `.env` or `docker-compose.yml` |
| Database connection refused | Wait for PostgreSQL health check to pass |
| Seeding takes too long | First startup inserts 300K rows — takes ~30 seconds |
| Frontend can't reach backend | Check that `vite.config.js` proxy targets the correct backend URL |
| Tests fail with ECONNREFUSED | Expected — unit tests run without a database; API tests handle this gracefully |

---

## Known Limitations

- Index recommendations are **rule-based**, not a complete database optimiser
- `EXPLAIN ANALYZE` **executes the query** — timing varies between runs due to caching and system load
- An index **does not always improve performance** — PostgreSQL may still prefer a sequential scan
- Recommendations are limited to the **controlled demo database** tables
- Only **safe read-only queries** (`SELECT`, `WITH ... SELECT`) are supported
- SQL parsing **cannot replace complete database isolation**
- PostgreSQL planner decisions depend on **statistics and data distribution**

---

## Future Improvements

- Visual plan tree using React Flow
- Query diff comparison between versions
- Table and index statistics dashboard
- EXPLAIN without ANALYZE mode for unsafe queries
- Query rewriting suggestions
- Export analysis results as PDF
- Support for additional SQL dialects
- User authentication for multi-tenant usage
- pg_stat_statements integration
- Query plan caching

---

## Resume Description

```
QueryLens — SQL Query Performance Analyzer
React.js · Node.js · Express.js · PostgreSQL · Docker

• Developed a PostgreSQL query-performance analysis platform that converts
  JSON EXPLAIN ANALYZE output into recursive execution-plan visualisations.

• Implemented a rule-based bottleneck detector for sequential scans,
  row-estimation mismatches, expensive joins and temporary disk operations.

• Built a metadata-aware index advisor and controlled before-versus-after
  benchmarking workflow to measure execution-time and buffer-usage improvements.

• Secured query execution through AST validation, read-only database
  permissions, statement timeouts and server-controlled index operations.
```

---

## Interview Talking Points

- How PostgreSQL's `EXPLAIN ANALYZE` works and why `FORMAT JSON` is used
- B-tree indexes and why PostgreSQL might ignore a recommended index
- Read-only transaction isolation and statement timeouts for security
- AST-based SQL validation vs string-matching approaches
- Rule-based analysis: balancing false positives with useful detection
- Docker multi-container orchestration with health checks
- Recursive tree parsing and frontend visualization
- Before-vs-after benchmarking with controlled index management

See [INTERVIEW_GUIDE.md](INTERVIEW_GUIDE.md) for detailed interview preparation.

---

## License

MIT
