// Report names only. Never print or validate secret values in logs.
const required = [
  "AZURE_CLIENT_ID",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AZURE_WEBAPP_NAME",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(
    `::error::CU Launch deployment settings are unavailable: ${missing.join(", ")}. Complete or repair publishing setup in CU Launch before retrying.`,
  );
  process.exitCode = 1;
} else {
  console.log("Required CU Launch deployment settings are present.");
}
