/*
 * Atlas live execution atomic reservation.
 *
 * execution_key is populated only for the new reservation-based
 * execution flow. Historical audit rows remain valid with NULL.
 */

alter table atlas_live_execution_logs
add column if not exists execution_key text;


/*
 * PostgreSQL allows multiple NULL values in a UNIQUE index,
 * so historical rows without execution_key are unaffected.
 *
 * Any new execution_key, however, may exist only once.
 */
create unique index if not exists
atlas_live_execution_logs_execution_key_uidx
on atlas_live_execution_logs(execution_key)
where execution_key is not null;


/*
 * Lookup support for execution reservations.
 */
create index if not exists
atlas_live_execution_logs_authorization_id_idx
on atlas_live_execution_logs(authorization_id);