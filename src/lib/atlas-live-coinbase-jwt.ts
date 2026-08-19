/**
 * ============================================================
 * YieldCraft Atlas
 * Live Coinbase JWT Boundary
 *
 * PURPOSE
 * Create Coinbase authentication JWT for Atlas live execution.
 *
 * SAFETY
 * - No order submission
 * - No execution logic
 * - No approval logic
 * - No authorization logic
 * - No UI access
 * - No Pulse
 * - No Recon
 *
 * This file only creates authentication context.
 * ============================================================
 */

import { SignJWT, importPKCS8 } from "jose";
import { createPrivateKey } from "crypto";

function normalizePem(
  pem: string | undefined
): string {
  if (!pem) {
    throw new Error(
      "ATLAS_COINBASE_PRIVATE_KEY is missing"
    );
  }

  return pem.replace(/\\n/g, "\n").trim();
}

export async function createAtlasCoinbaseJwt(
  method: string,
  path: string
): Promise<string> {

  const keyName =
    process.env.ATLAS_COINBASE_API_KEY_NAME;

  const rawPrivate =
    process.env.ATLAS_COINBASE_PRIVATE_KEY;

  const alg =
    (process.env.ATLAS_COINBASE_KEY_ALG as "ES256") ||
    "ES256";


  if (!keyName) {
    throw new Error(
      "ATLAS_COINBASE_API_KEY_NAME is missing"
    );
  }


  if (!rawPrivate) {
    throw new Error(
      "ATLAS_COINBASE_PRIVATE_KEY is missing"
    );
  }


  const normalizedPem =
    normalizePem(rawPrivate);


  const pkcs8Pem =
    createPrivateKey({
      key: normalizedPem,
      format: "pem",
    })
      .export({
        type: "pkcs8",
        format: "pem",
      })
      .toString();


  const privateKey =
    await importPKCS8(
      pkcs8Pem,
      alg
    );


  const now =
    Math.floor(
      Date.now() / 1000
    );


  const uri =
    `${method} api.coinbase.com${path}`;


  return await new SignJWT({
    sub: keyName,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri,
  })
    .setProtectedHeader({
      alg,
      kid: keyName,
      nonce:
        Math.random()
          .toString(36)
          .slice(2),
    })
    .sign(privateKey);
}