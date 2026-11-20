'use strict';

const {appendFile, mkdtemp, mkdir, readdir, writeFile, rm} = require('node:fs/promises');
const {spawnSync} = require('node:child_process');
const {tmpdir} = require('node:os');
const {join} = require('node:path');

async function run() {
  const projectionOnly = process.env.ATLAS_WATCHDOG_OWNER_PROJECTION_ONLY === 'true';
  const source = projectionOnly ? null : new URL(process.env.ATLAS_WATCHDOG_EVIDENCE_URL);
  const token = process.env.ATLAS_WATCHDOG_EVIDENCE_TOKEN;
  const databaseUrl = process.env.ATLAS_WATCHDOG_DATABASE_URL;
  if (!databaseUrl || (!projectionOnly && (source.protocol !== 'https:' || source.username || source.password || !token))) {
    throw Error('WATCHDOG_INPUTS_REQUIRED');
  }

  const directory = await mkdtemp(join(tmpdir(), 'atlas-watchdog-'));
  try {
    const evidence = join(directory, 'evidence.json');
    const spool = join(directory, 'incidents');
    await mkdir(spool, {mode: 0o700});
    const response = projectionOnly ? null : await fetch(source, {
      headers: {Authorization: 'Bearer ' + token},
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (response?.ok && response.body) {
      const chunks = [];
      let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > 2 * 1024 * 1024) throw Error('WATCHDOG_EVIDENCE_TOO_LARGE');
        chunks.push(chunk);
      }
      await writeFile(evidence, Buffer.concat(chunks), {mode: 0o600});
    }
    await writeFile(join(directory, 'database-url'), databaseUrl, {mode: 0o600});
    const result = spawnSync(process.execPath, [join(__dirname, 'watchdog-cycle.cjs')], {
      env: {
        CREDENTIALS_DIRECTORY: directory,
        ATLAS_WATCHDOG_APPROVED_DATABASE_HOST: process.env.ATLAS_WATCHDOG_APPROVED_DATABASE_HOST,
        ATLAS_WATCHDOG_EXPECTED_SCOPES: process.env.ATLAS_WATCHDOG_EXPECTED_SCOPES,
        ATLAS_WATCHDOG_SCHEDULER_EVIDENCE: evidence,
        ATLAS_WATCHDOG_OWNER_PROJECTION_ONLY: String(projectionOnly),
        ATLAS_WATCHDOG_SPOOL: spool,
      },
      stdio: ['ignore', 'inherit', 'ignore'],
      timeout: 30000,
    });
    const receipts = await readdir(spool);
    const [receipt] = receipts;
    const match = receipts.length === 1 && /^watchdog-([a-f0-9]{64})\.json$/.exec(receipt);
    if (result.status === 2 && match && process.env.GITHUB_OUTPUT) {
      await appendFile(process.env.GITHUB_OUTPUT, 'incident=' + match[1] + '\n');
    }
    return result.status ?? 2;
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

run().then(code => { process.exitCode = code; }).catch(() => {
  console.log(JSON.stringify({healthy: false, codes: ['WATCHDOG_ACTIONS_INPUT_UNAVAILABLE'], action: 'INSPECT_ONLY'}));
  process.exitCode = 2;
});
