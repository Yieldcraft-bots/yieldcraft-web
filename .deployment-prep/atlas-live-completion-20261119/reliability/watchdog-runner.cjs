'use strict';

const checkAt = value => Date.parse(value);
const validId = (id,pattern) => typeof id==='string' && pattern.test(id);
const scopePattern = /^[A-Za-z0-9_-]{1,128}$/;
const deploymentPattern = /^dpl_[A-Za-z0-9]+$/;
const transaction = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY';
const cycleIntervalMs = 15 * 60 * 1000;
const cycleGraceMs = 2 * 60 * 1000;

function validateExpected(expected) {
 if (!Array.isArray(expected) || !expected.length || expected.length>1000 ||
     expected.some(s=>!s || !validId(s.scopeId,scopePattern) ||
       !validId(s.deploymentId,deploymentPattern) || !['USD','USDC'].includes(s.currency) ||
       typeof s.enabled!=='boolean') || new Set(expected.map(s=>s.scopeId)).size!==expected.length) {
  throw Error('WATCHDOG_EXPECTED_SCOPE_BINDINGS_REQUIRED');
 }
}

function assessScope(row, expected, now) {
 const reasons=[], flag=reason=>reasons.push(reason+':'+expected.scopeId);
 if (!row) { flag('SCOPE_MISSING'); return reasons; }
 if (row.deployment_id!==expected.deploymentId || row.currency!==expected.currency || row.enabled!==expected.enabled) {
  flag('SCOPE_BINDING_DRIFT'); return reasons;
 }
 const at=checkAt(row.observed_at), expiry=checkAt(row.expires_at);
 if (!Number.isFinite(at) || at>now || now-at>120000 || !Number.isFinite(expiry) || expiry<=now) {
  flag('MONITOR_STALE');
 } else if (row.snapshot_binding_valid!==true || row.inventory_complete!==true) {
  flag('MONITOR_BINDING_OR_INVENTORY_UNVERIFIED');
 } else if (row.monitor_state!==(row.enabled?'OBSERVED':'DISARMED')) {
  flag('MONITOR_STATE_REQUIRES_REVIEW');
 }
 const slot=checkAt(row.slot), start=checkAt(row.started_at), end=checkAt(row.completed_at);
 const latestDueSlot = Math.floor((now-cycleGraceMs)/cycleIntervalMs)*cycleIntervalMs;
 const openSlot = Math.floor(now/cycleIntervalMs)*cycleIntervalMs;
 if (![slot,start,end].every(Number.isFinite) || (slot!==latestDueSlot && slot!==openSlot) ||
     start<slot || start>=slot+cycleGraceMs || end<start || end>now) {
  flag('CRON_MISSING_OR_STALE');
 } else if (!(row.enabled?['OK','WAIT']:['DISARMED']).includes(row.cycle_outcome)) {
  flag('CRON_OUTCOME_REQUIRES_REVIEW');
 }
 return reasons;
}

const inventorySql='SELECT * FROM atlas_watchdog.inventory()';

async function observe(client,expected) {
 validateExpected(expected);
 await client.query(transaction);
 try {
  const role=await client.query("SELECT transaction_timestamp() AS now,r.rolsuper,r.rolbypassrls,current_setting('transaction_read_only') AS read_only, (pg_has_role(current_user,'atlas_watchdog_observer','USAGE') OR (current_user='atlas_watchdog_github' AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid))) AND has_schema_privilege(current_user,'atlas_watchdog','USAGE') AND has_function_privilege(current_user,to_regprocedure('atlas_watchdog.inventory()'),'EXECUTE') AS observer, EXISTS(SELECT 1 FROM unnest(ARRAY['public.atlas_multi_asset_recurring_scopes','public.client_health_snapshots','public.strategy_decisions']) AS watched(tbl) WHERE has_any_column_privilege(tbl,'SELECT') OR has_table_privilege(tbl,'INSERT,UPDATE,DELETE,TRUNCATE')) AS base_access FROM pg_roles r WHERE rolname=current_user");
  const identity=role.rows[0];
  if(role.rows.length!==1||identity.rolsuper!==false||identity.rolbypassrls!==false||identity.read_only!=='on'||identity.observer!==true||identity.base_access!==false)
   throw Error('WATCHDOG_READ_ONLY_ROLE_REQUIRED');
  const now=checkAt(identity.now);
  if(!Number.isFinite(now))throw Error('WATCHDOG_DATABASE_CLOCK_UNPROVEN');
  const {rows}=await client.query(inventorySql);
  if(rows.length>1000 || new Set(rows.map(row=>row.scope_id)).size!==rows.length)
   throw Error('WATCHDOG_SCOPE_INVENTORY_INCOMPLETE');
  const expectedIds=new Set(expected.map(s=>s.scopeId)), byScope=new Map(rows.map(r=>[r.scope_id,r]));
  const reasons=expected.flatMap(s=>assessScope(byScope.get(s.scopeId),s,now));
  if(rows.some(row=>!expectedIds.has(row.scope_id)))reasons.push('UNEXPECTED_SCOPE_PRESENT');
  await client.query('COMMIT');
  return {healthy:reasons.length===0,reasons,scopeCount:rows.length,tradingAuthority:false,
   inventoryComplete:true,schedulerProven:false,externalDeliveryVerified:false,productionMutations:0};
 } catch(error) {
  await client.query('ROLLBACK').catch(()=>{});
  throw error;
 }
}

function connectionOptions(url,approvedHost) {
 const address=new URL(url);
 if(!['postgres:','postgresql:'].includes(address.protocol)||address.hostname!==approvedHost||
    !/\.(supabase\.co|pooler\.supabase\.com)$/.test(approvedHost)||
    address.search||address.hash||!address.username||!address.password||
    !/^\/[A-Za-z0-9_-]+$/.test(address.pathname)||!['','5432','6543'].includes(address.port))
  throw Error('WATCHDOG_APPROVED_DATABASE_HOST_REQUIRED');
 return {host:address.hostname,port:Number(address.port||5432),database:address.pathname.slice(1),
  user:decodeURIComponent(address.username),password:decodeURIComponent(address.password),
  ssl:{rejectUnauthorized:true,ca:require('node:fs').readFileSync(require('node:path').join(__dirname,'supabase-root-2021.crt'))},connectionTimeoutMillis:3000,query_timeout:3000,statement_timeout:2000};
}

module.exports={observe,connectionOptions};

if(require.main===module){
 (async()=>{
  const {Client}=require('pg'), url=process.env.ATLAS_WATCHDOG_DATABASE_URL,
   host=process.env.ATLAS_WATCHDOG_APPROVED_DATABASE_HOST,
   expected=JSON.parse(process.env.ATLAS_WATCHDOG_EXPECTED_SCOPES||'null');
  validateExpected(expected);
  const db=new Client(connectionOptions(url,host));
  try {
   await db.connect();
   const result=await observe(db,expected);
   console.log(JSON.stringify(result));
   process.exitCode=result.healthy?0:2;
  } finally {await db.end();}
 })().catch(()=>{
  console.log(JSON.stringify({healthy:false,reason:'WATCHDOG_UNAVAILABLE',tradingAuthority:false,
   schedulerProven:false,externalDeliveryVerified:false,productionMutations:0}));
  process.exitCode=2;
 });
}
