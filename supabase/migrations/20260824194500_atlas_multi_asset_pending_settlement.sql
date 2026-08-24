-- ============================================================
-- YieldCraft Atlas Multi-Asset
-- Atomic Pending Allocation Settlement
-- ------------------------------------------------------------
-- PURPOSE
-- Atomically consume a confirmed submitted order amount from
-- one client's one asset pending allocation bucket.
--
-- SAFETY
-- - Multi-Asset only
-- - Per-client user_id isolation
-- - Does not touch atlas_user_state
-- - Does not touch legacy Atlas BTC
-- - Does not touch Pulse
-- - Does not touch Recon
-- ============================================================


create or replace function
public.consume_atlas_multi_asset_pending_allocation(
  p_user_id uuid,
  p_asset_symbol text,
  p_amount_usd numeric
)
returns table (
  consumed boolean,
  previous_pending_usd numeric,
  remaining_pending_usd numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_symbol text;
  v_previous numeric;
  v_remaining numeric;
begin

  v_symbol :=
    upper(
      trim(
        p_asset_symbol
      )
    );


  if
    p_user_id is null
  then
    raise exception
      'atlas_multi_asset_user_id_missing';
  end if;


  if
    v_symbol = ''
  then
    raise exception
      'atlas_multi_asset_asset_symbol_missing';
  end if;


  if
    p_amount_usd is null
    or p_amount_usd <= 0
  then
    raise exception
      'atlas_multi_asset_settlement_amount_invalid';
  end if;


  /*
   * Lock exactly one client's one asset bucket.
   *
   * This prevents concurrent settlement calls from consuming
   * the same pending dollars twice.
   */
  select
    pending_usd
  into
    v_previous
  from
    public.atlas_multi_asset_pending_allocations
  where
    user_id = p_user_id
    and asset_symbol = v_symbol
  for update;


  if not found then

    return query
    select
      false,
      0::numeric,
      0::numeric;

    return;

  end if;


  if
    v_previous < p_amount_usd
  then

    return query
    select
      false,
      v_previous,
      v_previous;

    return;

  end if;


  v_remaining :=
    greatest(
      v_previous - p_amount_usd,
      0
    );


  /*
   * Remove an empty bucket entirely.
   */
  if
    v_remaining = 0
  then

    delete from
      public.atlas_multi_asset_pending_allocations
    where
      user_id = p_user_id
      and asset_symbol = v_symbol;

  else

    update
      public.atlas_multi_asset_pending_allocations
    set
      pending_usd =
        v_remaining,

      updated_at =
        now()
    where
      user_id = p_user_id
      and asset_symbol = v_symbol;

  end if;


  return query
  select
    true,
    v_previous,
    v_remaining;

end;
$$;


comment on function
public.consume_atlas_multi_asset_pending_allocation(
  uuid,
  text,
  numeric
)
is
  'Atomically consumes one confirmed Atlas Multi-Asset submitted order amount from one client asset pending bucket. Does not affect legacy Atlas BTC, Pulse, or Recon.';