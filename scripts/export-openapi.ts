/** Writes the generated OpenAPI document to docs/api/openapi.json. */
import { writeFileSync } from "node:fs";
import { buildApp } from "../backend/src/app.js";
import { loadConfig } from "../backend/src/config.js";

const app = await buildApp(
  loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", POLICY_DIR: "/nonexistent" }),
);
await app.ready();
writeFileSync("docs/api/openapi.json", JSON.stringify(app.swagger(), null, 2) + "\n");
await app.close();
console.log("wrote docs/api/openapi.json");
