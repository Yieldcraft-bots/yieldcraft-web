/**
============================================================
YieldCraft Atlas
Atlas Portfolio Plan Persistence

PURPOSE
Store validated portfolio execution plans.

SAFETY
- Persistence only
- No trading
- No execution
- No Coinbase
- No Pulse
- No Recon

This table stores planning state only.
============================================================
*/

create table if not exists public.atlas_portfolio_plans (
  id uuid primary key default gen_random_uuid(),

  portfolio_plan_id uuid not null unique,

  user_id uuid not null,

  valid boolean not null,

  reason text not null,

  deployable_usd numeric not null,

  allocation_total_percent numeric not null,

  planned_usd numeric not null,

  unplanned_usd numeric not null,

  orders jsonb not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists atlas_portfolio_plans_user_id_idx
on public.atlas_portfolio_plans(user_id);

create index if not exists atlas_portfolio_plans_portfolio_plan_id_idx
on public.atlas_portfolio_plans(portfolio_plan_id);

/*
Server-side repository access only.
*/

revoke all on table public.atlas_portfolio_plans
from public;

revoke all on table public.atlas_portfolio_plans
from anon;

revoke all on table public.atlas_portfolio_plans
from authenticated;

grant select, insert, update, delete
on table public.atlas_portfolio_plans
to service_role;