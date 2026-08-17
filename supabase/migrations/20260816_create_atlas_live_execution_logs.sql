create table if not exists atlas_live_execution_logs (
  id uuid primary key default gen_random_uuid(),

  created_at timestamptz not null default now(),

  status text not null,

  user_id uuid not null,

  authorization_id uuid not null,

  portfolio_plan_id uuid not null,

  product_id text not null,

  quote_size_usd numeric not null,

  coinbase_order_id text,

  response_summary text not null
);


create index if not exists atlas_live_execution_logs_user_id_idx
on atlas_live_execution_logs(user_id);


create index if not exists atlas_live_execution_logs_created_at_idx
on atlas_live_execution_logs(created_at);