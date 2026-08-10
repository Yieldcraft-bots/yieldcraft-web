/**
 * ============================================================
 * YieldCraft Atlas
 * Atlas Execution Authorization Persistence
 * ------------------------------------------------------------
 * PURPOSE
 * Store execution authorization governance state.
 *
 * SAFETY
 * - Governance persistence only
 * - No trading
 * - No execution
 * - No Coinbase access
 * - No Pulse
 * - No Recon
 *
 * This table does NOT submit orders.
 * This table does NOT authorize exchange actions.
 * It stores authorization lifecycle state only.
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


create index if not exists
atlas_execution_authorizations_user_id_idx
on public.atlas_execution_authorizations(user_id);


create index if not exists
atlas_execution_authorizations_status_idx
on public.atlas_execution_authorizations(status);


create index if not exists
atlas_execution_authorizations_portfolio_plan_id_idx
on public.atlas_execution_authorizations(portfolio_plan_id);


/**
 * Automatically maintain updated_at.
 */

create or replace function public.update_atlas_execution_authorizations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists
atlas_execution_authorizations_updated_at
on public.atlas_execution_authorizations;


create trigger
atlas_execution_authorizations_updated_at
before update
on public.atlas_execution_authorizations
for each row
execute function
public.update_atlas_execution_authorizations_updated_at();


/**
 * Server-side repository access only.
 */

revoke all
on table public.atlas_execution_authorizations
from public;


revoke all
on table public.atlas_execution_authorizations
from anon;


revoke all
on table public.atlas_execution_authorizations
from authenticated;


grant select, insert, update, delete
on table public.atlas_execution_authorizations
to service_role;