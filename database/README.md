# QueryLens Database

## Overview

PostgreSQL 16 database with a realistic e-commerce schema designed to demonstrate query performance analysis.

## Schema

### customers
| Column     | Type         | Description              |
|------------|--------------|--------------------------|
| id         | SERIAL PK    | Customer identifier      |
| name       | VARCHAR(100) | Customer name            |
| email      | VARCHAR(150) | Email address            |
| city       | VARCHAR(80)  | City of residence        |
| created_at | TIMESTAMP    | Account creation date    |

### orders
| Column        | Type          | Description              |
|---------------|---------------|--------------------------|
| id            | SERIAL PK     | Order identifier         |
| customer_id   | INTEGER FK    | References customers(id) |
| status        | VARCHAR(20)   | Order status             |
| total_amount  | NUMERIC(10,2) | Total order value        |
| order_date    | DATE          | Date order was placed    |
| shipping_city | VARCHAR(80)   | Destination city         |

### order_items
| Column       | Type          | Description             |
|--------------|---------------|-------------------------|
| id           | SERIAL PK     | Item identifier         |
| order_id     | INTEGER FK    | References orders(id)   |
| product_name | VARCHAR(120)  | Product name            |
| category     | VARCHAR(60)   | Product category        |
| quantity     | INTEGER       | Quantity ordered        |
| unit_price   | NUMERIC(10,2) | Price per unit          |

### query_analysis_history
| Column               | Type          | Description                |
|----------------------|---------------|----------------------------|
| id                   | SERIAL PK     | History entry identifier   |
| query_text           | TEXT          | The SQL query analyzed     |
| execution_time_ms    | NUMERIC(10,2) | Execution time             |
| planning_time_ms     | NUMERIC(10,2) | Planning time              |
| findings_json        | JSONB         | Bottleneck findings        |
| recommendations_json | JSONB         | Index recommendations      |
| plan_json            | JSONB         | Full execution plan        |
| created_at           | TIMESTAMP     | When analysis was run      |

## Data Volume

- **5,000** customers
- **100,000** orders
- **200,000** order items

## Intentional Design

Indexes are **intentionally omitted** on filter columns like `customer_id`, `shipping_city`, `status`, `product_name`, `email`, and `city` to produce sequential scans during demonstrations.

## Roles

- `querylens_app` — Read-only access for query analysis
- `querylens_admin` — Full access for controlled index management
