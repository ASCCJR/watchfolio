import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "../scripts/sites-env.mjs";
import { Miniflare } from "miniflare";

const webRoot = fileURLToPath(new URL("../", import.meta.url));

export async function startWorker(t, { outboundService, beforeMigration }) {
  const build = join(webRoot, "dist", "server");
  const config = JSON.parse(await readFile(join(build, "wrangler.json"), "utf8"));
  const chunks = (await readdir(build, { recursive: true }))
    .filter(file => /\.m?js$/.test(file) && file !== config.main);
  const worker = new Miniflare({
    modulesRoot: build,
    modules: [config.main, ...chunks].map(file => ({ type: "ESModule", path: join(build, file) })),
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    d1Databases: ["DB"],
    d1Persist: false,
    cf: false,
    outboundService,
  });
  t.after(() => worker.dispose());
  const db = await worker.getD1Database("DB");
  const migrations = join(webRoot, "drizzle");
  for (const file of (await readdir(migrations)).filter(file => file.endsWith(".sql")).sort()) {
    if (beforeMigration) await beforeMigration(db, file);
    const sql = await readFile(join(migrations, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.prepare(statement.trim()).run();
    }
  }
  // Synthetic identities stand in for the server headers injected by Sites.
  function session(id) {
    return async (path, method = "GET", expectedStatus = 200, data) => {
      const headers = id ? { "oai-authenticated-user-id": id, "oai-authenticated-user-email": id + "@example.test" } : {};
      if (data !== undefined) headers["content-type"] = "application/json";
      const response = await worker.dispatchFetch("https://watchfolio.test" + path, { method, headers, body: JSON.stringify(data) });
      const body = await response.text();
      assert.equal(response.status, expectedStatus, method + " " + path + ": " + body.slice(0, 300));
      return JSON.parse(body);
    };
  }
  return { db, session };
}
