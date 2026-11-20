'use strict';

const {readFile, open, link, unlink} = require('node:fs/promises');
const {constants} = require('node:fs');
const {createHash, randomUUID} = require('node:crypto');
const {isAbsolute, join} = require('node:path');
const {observe, connectionOptions} = require('../../atlas-live-completion-20261119/reliability/watchdog-runner.cjs');
const {assessScheduledCompletion} = require('../../atlas-urgent-20261119/watchdog/scheduler-evidence.cjs');

const interval = 15 * 60_000;
const grace = 2 * 60_000;
const maxEvidenceBytes = 2 * 1024 * 1024;
const projectionCodes = new Set([
  'SCOPE_MISSING', 'SCOPE_BINDING_DRIFT', 'MONITOR_STALE',
  'MONITOR_BINDING_OR_INVENTORY_UNVERIFIED', 'MONITOR_STATE_REQUIRES_REVIEW',
  'CRON_MISSING_OR_STALE', 'CRON_OUTCOME_REQUIRES_REVIEW', 'UNEXPECTED_SCOPE_PRESENT',
]);

async function readSchedulerEvidence(filename) {
  if (!isAbsolute(filename)) throw Error('WATCHDOG_EVIDENCE_PATH_REQUIRED');
  const file = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > maxEvidenceBytes) throw Error('WATCHDOG_EVIDENCE_FILE_INVALID');
    const raw = Buffer.alloc(metadata.size + 1);
    let offset = 0;
    while (offset < raw.length) {
      const {bytesRead} = await file.read(raw, offset, raw.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== metadata.size) throw Error('WATCHDOG_EVIDENCE_FILE_INVALID');
    return JSON.parse(raw.subarray(0, offset));
  } finally {
    await file.close();
  }
}

async function assess({expected, now, readProjection, readEvidence, projectionOnly = false}) {
  let projection;
  let codes = [];
  try {
    projection = await readProjection();
    if (!Array.isArray(projection.reasons) || typeof projection.healthy !== 'boolean' || projection.inventoryComplete !== true ||
        (projection.healthy !== (projection.reasons.length === 0))) throw Error('WATCHDOG_PROJECTION_INVALID');
    codes = projection.reasons.map(reason => {
      const code = typeof reason === 'string' && reason.split(':', 1)[0];
      return projectionCodes.has(code) ? code : 'PROJECTION_FINDING_UNCLASSIFIED';
    });
  } catch {
    codes.push('PROJECTION_UNAVAILABLE');
  }

  const observedAt = now();
  const slot = Math.floor((observedAt - grace) / interval) * interval;
  let evidence;
  if (!projectionOnly) {
    try { evidence = await readEvidence(); } catch { /* stale or unavailable evidence fails closed below */ }
  }
  const scheduler = projectionOnly ? [] : expected.map(({scopeId, deploymentId}) => assessScheduledCompletion({
    now: observedAt, observedAt: evidence?.observedAt, scopeId, deploymentId,
    platform: evidence?.platform, witness: evidence?.witness,
  }));
  codes.push(...scheduler.filter(result => result.state !== 'HEALTHY').map(result => result.state));
  codes = [...new Set(codes)].sort();

  return {
    schema: 'atlas-watchdog-local-v1',
    observedAt: new Date(observedAt).toISOString(),
    dueSlot: new Date(slot).toISOString(),
    healthy: codes.length === 0,
    codes,
    action: codes.length === 0 ? 'NONE' : 'INSPECT_ONLY',
    schedulerProven: false,
    evidenceMode: projectionOnly ? 'OWNER_PERSISTED_CYCLE' : 'PROVIDER_AND_PERSISTED_CYCLE',
    schedulerCorrelated: scheduler.length > 0 && scheduler.every(result => result.state === 'HEALTHY'),
    expectedScopeCount: expected.length,
    productionMutations: 0,
    externalDeliveryVerified: false,
  };
}

// Publish complete files atomically without replacing another run's evidence.
// Identical findings in the same due slot share a receipt across restarts.
async function record(directory, result) {
  if (!isAbsolute(directory)) throw Error('WATCHDOG_SPOOL_ABSOLUTE_PATH_REQUIRED');
  const key = createHash('sha256').update(JSON.stringify([
    result.dueSlot, result.codes, result.expectedScopeCount,
  ])).digest('hex');
  const destination = join(directory, 'watchdog-' + key + '.json');
  const temporary = join(directory, '.watchdog-' + randomUUID() + '.tmp');
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(result) + '\n');
      await file.sync();
    } finally {
      await file.close();
    }
    try { await link(temporary, destination); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return false;
    }
    return true;
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function run(env = process.env) {
  const projectionOnly = env.ATLAS_WATCHDOG_OWNER_PROJECTION_ONLY === 'true';
  const expected = JSON.parse(env.ATLAS_WATCHDOG_EXPECTED_SCOPES || 'null');
  if (!Array.isArray(expected) || expected.length < 1 || expected.length > 1000 ||
      !isAbsolute(env.ATLAS_WATCHDOG_SPOOL || '') ||
      (!projectionOnly && !isAbsolute(env.ATLAS_WATCHDOG_SCHEDULER_EVIDENCE || ''))) {
    throw Error('WATCHDOG_CONFIGURATION_REQUIRED');
  }
  const {Client} = require('pg');
  const credentials = env.CREDENTIALS_DIRECTORY;
  if (!isAbsolute(credentials || '')) throw Error('WATCHDOG_CREDENTIAL_DIRECTORY_REQUIRED');
  const url = (await readFile(join(credentials, 'database-url'), 'utf8')).trim();
  const db = new Client(connectionOptions(url, env.ATLAS_WATCHDOG_APPROVED_DATABASE_HOST));
  const result = await assess({
    expected, now: Date.now, projectionOnly,
    readProjection: async () => {
      try {
        await db.connect();
        return await observe(db, expected);
      } finally {
        await db.end();
      }
    },
    readEvidence: () => readSchedulerEvidence(env.ATLAS_WATCHDOG_SCHEDULER_EVIDENCE),
  });
  await record(env.ATLAS_WATCHDOG_SPOOL, result);
  console.log(JSON.stringify(result));
  return result.healthy ? 0 : 2;
}

module.exports = {assess, record, readSchedulerEvidence};

if (require.main === module) {
  run().then(code => { process.exitCode = code; }).catch(() => {
    console.log(JSON.stringify({healthy: false, codes: ['WATCHDOG_RUNTIME_OR_SPOOL_UNAVAILABLE'], action: 'INSPECT_ONLY'}));
    process.exitCode = 2;
  });
}


