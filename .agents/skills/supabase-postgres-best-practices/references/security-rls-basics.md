---
title: Enable Row Level Security for Multi-Tenant Data
impact: CRITICAL
impactDescription: Database-enforced tenant isolation, prevent data leaks
tags: rls, row-level-security, multi-tenant, security
---

## Enable Row Level Security for Multi-Tenant Data

Row Level Security (RLS) enforces data access at the database level, ensuring users only see their own data.

**Incorrect (application-level filtering only):**

```sql
-- Relying only on application to filter
select * from orders where user_id = $current_user_id;

-- Bug or bypass means all data is exposed!
select * from orders;  -- Returns ALL orders
```

**Correct (database-enforced RLS):**

```sql
-- Enable RLS on the table
alter table orders enable row level security;

-- Supabase: use the authenticated JWT identity, which users cannot spoof
create policy orders_user_policy on orders
  for all
  to authenticated
  using (user_id = (select auth.uid()));

-- Force RLS even for table owners
alter table orders force row level security;
```

If a non-Supabase deployment needs a custom `current_setting` identity, restrict
that pattern to trusted middleware-only connections whose database role cannot
set the value directly. Treat user-settable session GUCs as spoofable and do not
use them as an authorization boundary.

Policy for an authenticated role:

```sql
create policy orders_user_policy on orders
  for all
  to authenticated
  using (user_id = (select auth.uid()));
```

Reference: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
