async function printFullPayloads() {
  const baseUrl = process.env.WORKFORCE_API_URL || "https://api.prosyncedu.com/api";
  const apiKey = process.env.WORKFORCE_API_KEY;
  if (!apiKey) throw new Error("WORKFORCE_API_KEY is required.");

  console.log("=== Fetching Departments Full Data ===");
  const dRes = await fetch(`${baseUrl}/crm/departments`, {
    headers: { "X-API-KEY": apiKey, "Accept": "application/json" },
  });
  const dJson = await dRes.json();
  console.log(JSON.stringify(dJson, null, 2));

  console.log("\n=== Fetching Employees Full Data ===");
  const eRes = await fetch(`${baseUrl}/crm/employees`, {
    headers: { "X-API-KEY": apiKey, "Accept": "application/json" },
  });
  const eJson = await eRes.json();
  console.log(JSON.stringify(eJson, null, 2));
}

printFullPayloads();
