/*
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * Authoritative Live Execution Settlement Timestamp
 * ------------------------------------------------------------
 * PURPOSE
 * Add an authoritative settlement timestamp to live execution
 * audit rows so downstream policy can reason about actual
 * successful settlement time instead of reservation/create time.
 *
 * SAFETY
 * - Metadata only
 * - No Coinbase calls
 * - No order submission
 * - No pending-allocation mutation
 * - No approval mutation
 * - No authorization mutation
 * - No SELL logic
 * - No Pulse
 * - No Recon
 * - No legacy Atlas
 *
 * IMPORTANT
 * Historical SETTLED rows are NOT blindly backfilled here.
 * Their original created_at value may represent reservation or
 * submission time rather than authoritative settlement time.
 *
 * New settlements will populate settled_at atomically in the
 * settlement transaction.
 * ============================================================
 */


alter table
public.atlas_live_execution_logs
add column if not exists
settled_at timestamptz;


/*
 * Lookup support for:
 *
 * - user + product settlement history
 * - equity daily-stage policy
 * - recent settled execution inspection
 */
create index if not exists
atlas_live_execution_logs_user_product_settled_at_idx
on public.atlas_live_execution_logs (
  user_id,
  product_id,
  settled_at desc
)
where
  status = 'SETTLED'
  and settled_at is not null;


/*
 * Guard against contradictory state where a non-SETTLED row
 * accidentally carries an authoritative settlement timestamp.
 *
 * Existing historical rows have settled_at NULL, so this is
 * backward compatible.
 */
alter table
public.atlas_live_execution_logs
drop constraint if exists
atlas_live_execution_logs_settled_at_status_check;


alter table
public.atlas_live_execution_logs
add constraint
atlas_live_execution_logs_settled_at_status_check
check (
  settled_at is null
  or status = 'SETTLED'
);


comment on column
public.atlas_live_execution_logs.settled_at
is
  'Authoritative timestamp written only when an Atlas Multi-Asset live execution is successfully settled through the atomic settlement transaction.';