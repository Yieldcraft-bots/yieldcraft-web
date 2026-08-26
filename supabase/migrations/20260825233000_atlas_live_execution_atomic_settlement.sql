-- ============================================================
-- YieldCraft Atlas Multi-Asset
-- Exactly-Once Live Execution Settlement
-- ------------------------------------------------------------
-- PURPOSE
-- Atomically:
--
-- 1. Claim one existing SUBMITTED live execution
-- 2. Verify its Coinbase order identity
-- 3. Lock the client's pending asset bucket
-- 4. Consume the authoritative filled USD exactly once
-- 5. Mark the SAME execution SETTLED
--
-- All operations occur inside one PostgreSQL transaction.
--
-- SAFETY
-- - Multi-Asset only
-- - No Coinbase calls
-- - No order submission
-- - No approval mutation
-- - No authorization mutation
-- - No portfolio-plan mutation
-- - Does not touch atlas_user_state
-- - Does not touch legacy Atlas BTC
-- - Does not touch Pulse
-- - Does not touch Recon
-- ============================================================


create or replace function
public.settle_atlas_live_execution_and_consume_pending(
  p_execution_key text,
  p_coinbase_order_id text,
  p_expected_product_id text,
  p_asset_symbol text,
  p_filled_value_usd numeric
)
returns table (
  settled boolean,
  user_id uuid,
  previous_pending_usd numeric,
  remaining_pending_usd numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_execution record;

  v_symbol text;

  v_previous numeric;

  v_remaining numeric;
begin

  /*
   * ========================================================
   * VALIDATION
   * ========================================================
   */

  if
    nullif(
      trim(
        p_execution_key
      ),
      ''
    ) is null
  then
    raise exception
      'atlas_live_execution_key_missing';
  end if;


  if
    nullif(
      trim(
        p_coinbase_order_id
      ),
      ''
    ) is null
  then
    raise exception
      'atlas_live_coinbase_order_id_missing';
  end if;


  if
    nullif(
      trim(
        p_expected_product_id
      ),
      ''
    ) is null
  then
    raise exception
      'atlas_live_product_id_missing';
  end if;


  v_symbol :=
    upper(
      trim(
        p_asset_symbol
      )
    );


  if
    v_symbol = ''
  then
    raise exception
      'atlas_multi_asset_asset_symbol_missing';
  end if;


  if
    p_filled_value_usd is null
    or p_filled_value_usd <= 0
  then
    raise exception
      'atlas_live_filled_value_invalid';
  end if;


  /*
   * ========================================================
   * CLAIM EXACT SUBMITTED EXECUTION
   * ========================================================
   *
   * FOR UPDATE serializes reconciliation attempts against the
   * same execution_key.
   *
   * Only SUBMITTED executions are eligible.
   *
   * Once the first transaction marks the row SETTLED,
   * another request cannot consume the same fill again.
   */

  select
    user_id,
    product_id,
    coinbase_order_id,
    status
  into
    v_execution
  from
    public.atlas_live_execution_logs
  where
    execution_key =
      trim(
        p_execution_key
      )
    and status =
      'SUBMITTED'
  for update;


  if not found then

    return query
    select
      false,
      null::uuid,
      0::numeric,
      0::numeric;

    return;

  end if;


  /*
   * Coinbase identity must exactly match the existing
   * persisted execution.
   */

  if
    v_execution.coinbase_order_id <>
    trim(
      p_coinbase_order_id
    )
  then
    raise exception
      'atlas_live_coinbase_order_id_mismatch';
  end if;


  if
    v_execution.product_id <>
    trim(
      p_expected_product_id
    )
  then
    raise exception
      'atlas_live_product_id_mismatch';
  end if;


  /*
   * ========================================================
   * LOCK PENDING ASSET BUCKET
   * ========================================================
   */

  select
    pending_usd
  into
    v_previous
  from
    public.atlas_multi_asset_pending_allocations
  where
    user_id =
      v_execution.user_id
    and asset_symbol =
      v_symbol
  for update;


  if not found then

    return query
    select
      false,
      v_execution.user_id,
      0::numeric,
      0::numeric;

    return;

  end if;


  if
    v_previous <
    p_filled_value_usd
  then

    return query
    select
      false,
      v_execution.user_id,
      v_previous,
      v_previous;

    return;

  end if;


  v_remaining :=
    greatest(
      v_previous -
      p_filled_value_usd,
      0
    );


  /*
   * ========================================================
   * CONSUME EXACT AUTHORITATIVE FILL
   * ========================================================
   */

  if
    v_remaining = 0
  then

    delete from
      public.atlas_multi_asset_pending_allocations
    where
      user_id =
        v_execution.user_id
      and asset_symbol =
        v_symbol;

  else

    update
      public.atlas_multi_asset_pending_allocations
    set
      pending_usd =
        v_remaining,

      updated_at =
        now()
    where
      user_id =
        v_execution.user_id
      and asset_symbol =
        v_symbol;

  end if;


  /*
   * ========================================================
   * TERMINAL SETTLEMENT
   * ========================================================
   *
   * This occurs in the SAME transaction as pending
   * consumption.
   *
   * Either both changes commit or neither does.
   */

  update
    public.atlas_live_execution_logs
  set
    status =
      'SETTLED',

    response_summary =
      'coinbase_order_filled_and_pending_settled'
  where
    execution_key =
      trim(
        p_execution_key
      )
    and status =
      'SUBMITTED'
    and coinbase_order_id =
      trim(
        p_coinbase_order_id
      );


  if not found then
    raise exception
      'atlas_live_execution_settlement_claim_lost';
  end if;


  return query
  select
    true,
    v_execution.user_id,
    v_previous,
    v_remaining;

end;
$$;


/*
 * Server-side service role only.
 */

revoke all on function
public.settle_atlas_live_execution_and_consume_pending(
  text,
  text,
  text,
  text,
  numeric
)
from public;


revoke all on function
public.settle_atlas_live_execution_and_consume_pending(
  text,
  text,
  text,
  text,
  numeric
)
from anon;


revoke all on function
public.settle_atlas_live_execution_and_consume_pending(
  text,
  text,
  text,
  text,
  numeric
)
from authenticated;


grant execute on function
public.settle_atlas_live_execution_and_consume_pending(
  text,
  text,
  text,
  text,
  numeric
)
to service_role;


comment on function
public.settle_atlas_live_execution_and_consume_pending(
  text,
  text,
  text,
  text,
  numeric
)
is
  'Atomically settles one previously submitted Atlas Multi-Asset Coinbase execution and consumes its authoritative filled USD from exactly one client pending allocation bucket. Prevents duplicate fill settlement by locking the execution row and transitioning SUBMITTED to SETTLED in the same transaction.';