/**
 * ============================================================
 * YieldCraft Atlas
 * Atomic Client Allocation Replacement
 * ------------------------------------------------------------
 * PURPOSE
 * Replace one client's complete allocation plan in a single
 * PostgreSQL transaction.
 *
 * SAFETY
 * - Database-only allocation persistence
 * - No trading
 * - No execution
 * - No Coinbase access
 * - No Pulse imports
 * - No Recon imports
 *
 * If validation or insertion fails, PostgreSQL rolls back the
 * entire function call and preserves the previous allocation.
 * ============================================================
 */

create or replace function public.replace_client_allocation_plan(
  p_user_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_allocation_count integer;
  v_unique_symbol_count integer;
  v_total_percent numeric;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_allocations is null
     or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;

  select count(*)
  into v_allocation_count
  from jsonb_array_elements(p_allocations);

  if v_allocation_count = 0 then
    raise exception 'allocation plan must contain at least one asset';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_allocations) as allocation
    where jsonb_typeof(allocation) <> 'object'
       or nullif(trim(allocation ->> 'symbol'), '') is null
       or nullif(trim(allocation ->> 'targetPercent'), '') is null
  ) then
    raise exception 'each allocation requires symbol and targetPercent';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_allocations) as allocation
    where (allocation ->> 'targetPercent') !~
      '^[0-9]+([.][0-9]+)?$'
  ) then
    raise exception 'targetPercent must be numeric';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_allocations) as allocation
    where (allocation ->> 'targetPercent')::numeric <= 0
       or (allocation ->> 'targetPercent')::numeric > 100
  ) then
    raise exception
      'targetPercent must be greater than 0 and no more than 100';
  end if;

  select count(distinct upper(trim(allocation ->> 'symbol')))
  into v_unique_symbol_count
  from jsonb_array_elements(p_allocations) as allocation;

  if v_unique_symbol_count <> v_allocation_count then
    raise exception 'allocation symbols must be unique';
  end if;

  select coalesce(
    sum((allocation ->> 'targetPercent')::numeric),
    0
  )
  into v_total_percent
  from jsonb_array_elements(p_allocations) as allocation;

  if v_total_percent <> 100 then
    raise exception 'allocation percentages must total 100';
  end if;

  /*
   * Delete and insert occur inside the same function call and
   * therefore inside one PostgreSQL transaction.
   */
  delete from public.client_allocation_plans
  where user_id = p_user_id;

  insert into public.client_allocation_plans (
    user_id,
    asset_symbol,
    target_percent,
    enabled
  )
  select
    p_user_id,
    upper(trim(allocation ->> 'symbol')),
    (allocation ->> 'targetPercent')::numeric,
    true
  from jsonb_array_elements(p_allocations) as allocation;
end;
$$;

/*
 * This function is reserved for the server-side service role.
 * Browser clients cannot invoke it directly.
 */
revoke all on function public.replace_client_allocation_plan(
  uuid,
  jsonb
) from public;

revoke all on function public.replace_client_allocation_plan(
  uuid,
  jsonb
) from anon;

revoke all on function public.replace_client_allocation_plan(
  uuid,
  jsonb
) from authenticated;

grant execute on function public.replace_client_allocation_plan(
  uuid,
  jsonb
) to service_role;