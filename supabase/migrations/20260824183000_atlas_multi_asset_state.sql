-- ============================================================
-- YieldCraft Atlas Multi-Asset
-- Isolated Cash + Pending Allocation State
-- ------------------------------------------------------------
-- SAFETY
-- - Multi-Asset only
-- - Per-client state
-- - Does not modify atlas_user_state
-- - Does not modify legacy Atlas BTC
-- - Does not modify Pulse
-- - Does not modify Recon
-- ============================================================


create table if not exists public.atlas_multi_asset_cash_state (
  user_id uuid primary key references auth.users(id) on delete cascade,

  last_observed_cash_usd numeric(18, 8) not null default 0,

  accounted_cash_usd numeric(18, 8) not null default 0,

  last_processed_cash_usd numeric(18, 8) not null default 0,

  last_processed_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint atlas_multi_asset_cash_state_nonnegative
    check (
      last_observed_cash_usd >= 0
      and accounted_cash_usd >= 0
      and last_processed_cash_usd >= 0
    )
);


create table if not exists public.atlas_multi_asset_pending_allocations (
  user_id uuid not null references auth.users(id) on delete cascade,

  asset_symbol text not null,

  pending_usd numeric(18, 8) not null default 0,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  primary key (
    user_id,
    asset_symbol
  ),

  constraint atlas_multi_asset_pending_allocations_symbol
    check (
      length(trim(asset_symbol)) > 0
    ),

  constraint atlas_multi_asset_pending_allocations_nonnegative
    check (
      pending_usd >= 0
    )
);


create index if not exists
  atlas_multi_asset_pending_allocations_user_id_idx
on public.atlas_multi_asset_pending_allocations (
  user_id
);


comment on table public.atlas_multi_asset_cash_state is
  'Isolated per-client Atlas Multi-Asset cash accounting state. Not used by legacy Atlas BTC, Pulse, or Recon.';


comment on table public.atlas_multi_asset_pending_allocations is
  'Isolated per-client/per-asset Atlas Multi-Asset pending allocation ledger for sub-minimum deployment amounts.';


alter table public.atlas_multi_asset_cash_state
  enable row level security;


alter table public.atlas_multi_asset_pending_allocations
  enable row level security;