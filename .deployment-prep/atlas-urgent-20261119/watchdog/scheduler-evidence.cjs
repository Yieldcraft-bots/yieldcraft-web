'use strict';

const WINDOW_MS = 15 * 60 * 1000;
const GRACE_MS = 2 * 60 * 1000;

/**
 * Correlate independent scheduler observations to a persisted Atlas completion.
 * Data and timestamps come from the caller's approved observer. This evaluator
 * has no network, alert delivery, job dispatch, or recovery authority.
 */
function assessScheduledCompletion({now, observedAt, deploymentId, scopeId, platform, witness}) {
 if (!Number.isSafeInteger(now)||!Number.isSafeInteger(observedAt)||observedAt>now||
     now-observedAt>GRACE_MS||!/^dpl_[a-z0-9]+$/i.test(deploymentId)||!scopeId||
     !Array.isArray(platform)||!Array.isArray(witness)||platform.length>1000||witness.length>1000)
  return {state:'EVIDENCE_UNAVAILABLE',safeAction:'INSPECT_ONLY'};
 const slot=Math.floor((now-GRACE_MS)/WINDOW_MS)*WINDOW_MS;
 const arrivals=platform.filter(row=>row.deploymentId===deploymentId&&row.slot===slot&&
  row.path==='/api/atlas-multi-asset-cron'&&row.source==='VERCEL_CRON'&&
  Number.isSafeInteger(row.startedAt)&&row.startedAt>=slot&&row.startedAt<slot+GRACE_MS);
 const completions=witness.filter(row=>row.deploymentId===deploymentId&&row.scopeId===scopeId&&row.slot===slot&&
  Number.isSafeInteger(row.completedAt)&&row.completedAt>=slot&&row.completedAt<=now);
 const status=(state,safeAction)=>({state,slot,safeAction});
 if(arrivals.length>1||completions.length>1)return status('DUPLICATE_EVIDENCE','INSPECT_ONLY');
 if(!arrivals.length)return status('SCHEDULER_ARRIVAL_MISSING','INSPECT_ONLY');
 if(!completions.length)return status('ATLAS_COMPLETION_MISSING','RECONCILE_EXISTING_ONLY');
 const [arrival]=arrivals,[completion]=completions;
 if(arrival.httpStatus!==200||completion.completedAt<arrival.startedAt||
    !['DISARMED','OK','WAIT'].includes(completion.outcome))
  return status('CYCLE_REQUIRES_REVIEW','RECONCILE_EXISTING_ONLY');
 return status('HEALTHY','NONE');
}
module.exports={assessScheduledCompletion};
