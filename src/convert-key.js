// src/convert-key.js
// Converts a SEC1 EC private key (Coinbase) into PKCS#8 for jsonwebtoken

import { readFileSync, writeFileSync } from "fs";
import crypto from "crypto";
import path from "path";

function main() {
  // Load the Coinbase SEC1 key from file
  const sec1Path = path.join(process.cwd(), "src", "coinbase-sec1.pem");
  const sec1Key = readFileSync(sec1Path, "utf8");

  // Convert SEC1 ➜ PKCS8
  const keyObj = crypto.createPrivateKey({
    key: sec1Key,
    format: "pem",
    type: "sec1",
  });

  const pkcs8Pem = keyObj.export({
    format: "pem",
    type: "pkcs8",
  });

  // Write PKCS8 key
  const outPath = path.join(process.cwd(), "src", "coinbase-pkcs8.pem");
  writeFileSync(outPath, pkcs8Pem);

  console.log("\n✨ PKCS8 key written to:");
  console.log(outPath);
}

main();
