/**
 * ============================================================
 * YieldCraft Atlas
 * Atlas Execution Authorization Persistence
 * ------------------------------------------------------------
 * PURPOSE
 * Store execution authorization state.
 *
 * SAFETY
 * - Governance persistence only
 * - No trading
 * - No execution
 * - No Coinbase access
 * - No Pulse
 * - No Recon
 *
 * This table does NOT execute orders.
 * It stores authorization state only.
 * ============================================================
 */

create table if not exists public.atlas_execution_authorizations (
  id uuid primary key default gen_random_uuid(),

  authorization_id uuid not null unique,

  approval_id uuid not null,

  user_id uuid not null,

  portfolio_plan_id uuid not null,

  status text not null
    check (
      status in (
        'PENDING',
        'AUTHORIZED',
        'REVOKED'
      )
    ),

  authorized_at timestamptz null,

  reason text not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


create index if not exists atlas_execution_authorizations_user_id_idx
on public.atlas_execution_authorizations(user_id);


create index if not exists atlas_execution_authorizations_status_idx
on public.atlas_execution_authorizations(status);


create index if not exists atlas_execution_authorizations_portfolio_plan_id_idx
on public.atlas_execution_authorizations(portfolio_plan_id);


/*
 * Server-side repository access only.
 */

revoke all on table public.atlas_execution_authorizations
from public;

revoke all on table public.atlas_execution_authorizations
from anon;

revoke all on table public.atlas_execution_authorizations
from authenticated;

grant select, insert, update, delete
on table public.atlas_execution_authorizations
to service_role;