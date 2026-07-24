import jwt, {
  type SignOptions,
} from "jsonwebtoken";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing env: ${name}`);
  }

  return value.trim();
}

function normalizePem(pem: string) {
  let value = pem.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();
}

export function buildCdpJwt(
  method: string,
  path: string
) {
  const keyName = requireEnv(
    "COINBASE_API_KEY_NAME"
  );

  const privateKey = normalizePem(
    requireEnv("COINBASE_PRIVATE_KEY")
  );

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: keyName,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri: `${method} api.coinbase.com${path}`,
  };

  const options: SignOptions = {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: keyName,
    },
  };

  return jwt.sign(
    payload,
    privateKey,
    options
  );
}

export async function cbGet(
  path: string
) {
  const token = buildCdpJwt(
    "GET",
    path
  );

  return fetch(
    `https://api.coinbase.com${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );
}

export async function cbPost(
  path: string,
  body: unknown
) {
  const token = buildCdpJwt(
    "POST",
    path
  );

  return fetch(
    `https://api.coinbase.com${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
}