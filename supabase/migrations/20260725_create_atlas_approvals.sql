/**
 * ============================================================
 * YieldCraft Atlas
 * Atlas Approval Persistence
 * ------------------------------------------------------------
 * PURPOSE
 * Store Atlas approval contracts.
 *
 * SAFETY
 * - Approval state persistence only
 * - No trading
 * - No execution
 * - No Coinbase access
 * - No Pulse imports
 * - No Recon imports
 *
 * This table stores governance state only.
 * It does NOT authorize or submit orders.
 * ============================================================
 */

create table if not exists public.atlas_approvals (
  id uuid primary key default gen_random_uuid(),

  approval_id uuid not null unique,

  user_id uuid not null,

  portfolio_plan_id uuid not null,

  status text not null
    check (
      status in (
        'PENDING',
        'APPROVED',
        'REJECTED'
      )
    ),

  approved_at timestamptz null,

  reason text not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index if not exists atlas_approvals_user_id_idx
on public.atlas_approvals(user_id);

create index if not exists atlas_approvals_status_idx
on public.atlas_approvals(status);

create index if not exists atlas_approvals_portfolio_plan_id_idx
on public.atlas_approvals(portfolio_plan_id);


/*
 * Server-side repository access only.
 */

revoke all on table public.atlas_approvals
from public;

revoke all on table public.atlas_approvals
from anon;

revoke all on table public.atlas_approvals
from authenticated;

grant select, insert, update, delete
on table public.atlas_approvals
to service_role;