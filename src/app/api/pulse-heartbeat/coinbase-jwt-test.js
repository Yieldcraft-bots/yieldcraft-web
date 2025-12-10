// src/app/api/pulse-heartbeat/coinbase-jwt-test.js
// Simple canary: build a JWT using the env key and call Coinbase /accounts
// This is a direct port of Coinbase's official Python SDK logic.

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// 1) Load full API key name (organizations/.../apiKeys/...)
const apiKeyName =
  process.env.COINBASE_API_KEY_NAME ||
  "organizations/76dbf189-7838-4cd3-919e-6b9e0df3bec1/apiKeys/d9cd5723-5473-4dbb-94e1-527f922ce999";

// 2) Load the private key from env first, then fall back to local file
let rawKey = process.env.COINBASE_PRIVATE_KEY;
if (!rawKey) {
  const pkcs8Path = path.join(__dirname, "..", "..", "..", "coinbase-pkcs8.pem");
  rawKey = fs.readFileSync(pkcs8Path, "utf8");
}

// If the key is stored with \n sequences, convert them to real newlines
const privateKey = rawKey.replace(/\\n/g, "\n");

// 3) Build URI exactly like Coinbase's format_jwt_uri:
//    "GET api.coinbase.com/api/v3/brokerage/accounts"
function formatJwtUri(method, pathStr) {
  return `${method} api.coinbase.com${pathStr}`;
}

// 4) Build a Coinbase Advanced Trade REST JWT (ES256)
function buildJwt(method, pathStr) {
  if (!apiKeyName) {
    throw new Error("COINBASE_API_KEY_NAME is missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const uri = formatJwtUri(method, pathStr);

  const payload = {
    sub: apiKeyName,     // full key name
    iss: "cdp",          // constant per Coinbase SDK
    nbf: now,
    exp: now + 120,
    uri,                 // e.g. "GET api.coinbase.com/api/v3/brokerage/accounts"
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: {
      kid: apiKeyName,                       // full key name
      nonce: crypto.randomBytes(16).toString("hex"),
    },
  });

  return token;
}

async function main() {
  const method = "GET";
  const pathStr = "/api/v3/brokerage/accounts";

  const jwtToken = buildJwt(method, pathStr);

  const url = `https://api.coinbase.com${pathStr}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();

  console.log("\nStatus:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  console.log("Body:", text);

  if (res.status >= 400) {
    console.error("\nError response detected!");
    process.exit(1);
  }

  console.log("\n✅ Coinbase JWT test succeeded");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
