'use strict';

const { appendFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { assess } = require('./watchdog-cycle.cjs');

async function run() {
  const drillId = process.env.ATLAS_WATCHDOG_DRILL_ID;
  if (!/^[a-z0-9-]{8,48}$/.test(drillId ?? '')) throw Error('Invalid drill ID');

  const slot = Date.UTC(2026, 0, 1);
  const now = slot + 120001;
  const scopeId = 'fixture-scope';
  const deploymentId = 'dpl_Fixture';
  const expected = [{ scopeId, deploymentId }];
  const arrival = { deploymentId, slot, path: '/api/atlas-multi-asset-cron',
    source: 'VERCEL_CRON', startedAt: slot + 1000, httpStatus: 200 };
  const completion = { scopeId, deploymentId, slot, completedAt: slot + 2000, outcome: 'DISARMED' };
  const cases = [
    { platform: [], witness: [completion], expectedCode: 'SCHEDULER_ARRIVAL_MISSING' },
    { platform: [arrival], witness: [], expectedCode: 'ATLAS_COMPLETION_MISSING' },
  ];

  for (const { platform, witness, expectedCode } of cases) {
    const result = await assess({
      expected,
      now: () => now,
      readProjection: async () => ({ healthy: true, inventoryComplete: true, reasons: [] }),
      readEvidence: async () => ({ observedAt: now, platform, witness }),
    });
    if (result.healthy || result.codes.length !== 1 || result.codes[0] !== expectedCode ||
        result.action !== 'INSPECT_ONLY' || result.productionMutations !== 0) {
      throw Error('Unexpected fixture outcome');
    }
    console.log(expectedCode);
  }

  const incident = createHash('sha256').update(drillId).digest('hex');
  appendFileSync(process.env.GITHUB_OUTPUT, 'incident=' + incident + '\n');
}

run().catch(() => {
  console.error('Atlas watchdog fixture verification failed.');
  process.exitCode = 1;
});
