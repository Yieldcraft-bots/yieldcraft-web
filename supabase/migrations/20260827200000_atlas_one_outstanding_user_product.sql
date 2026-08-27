/*
 * ============================================================
 * YieldCraft Atlas Multi-Asset
 * One Outstanding Live Execution Per User + Product
 * ------------------------------------------------------------
 * PURPOSE
 * Prevent a second live Atlas accumulation order for the same
 * client/product while an earlier execution is still RESERVED
 * or SUBMITTED.
 *
 * SAFETY
 * - Atomic database enforcement
 * - Cross-authorization protection
 * - Does not affect SETTLED executions
 * - Does not affect FAILED executions
 * - Does not affect BLOCKED audit rows
 * - No Coinbase calls
 * - No SELL logic
 * - No Pulse
 * - No Recon
 * - No legacy Atlas
 * ============================================================
 */

create unique index if not exists
atlas_live_execution_logs_one_outstanding_user_product_uidx
on public.atlas_live_execution_logs (
  user_id,
  product_id
)
where status in (
  'RESERVED',
  'SUBMITTED'
);