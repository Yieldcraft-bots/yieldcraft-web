import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("Normalized Edge Outcomes processor starting...");

  const { POST } = await import("../src/app/api/edge-outcomes/route");

  const response = await POST();
  const body = await response.text();

  console.log(`HTTP status: ${response.status}`);
  console.log(body);

  if (!response.ok) {
    throw new Error(
      `Normalized Edge Outcomes processor failed with status ${response.status}`
    );
  }
}

main()
  .then(() => {
    console.log("Normalized Edge Outcomes processor complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Normalized Edge Outcomes processor failed:");
    console.error(error);
    process.exit(1);
  });