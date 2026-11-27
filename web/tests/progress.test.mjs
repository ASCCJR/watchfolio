import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import "../scripts/sites-env.mjs";
import { Miniflare } from "miniflare";
import { nextEpisode } from "../lib/progress.ts";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const show = { id: 123, name: "Lost", premiered: "2004-09-22", genres: ["Drama"] };
const episodes = [1, 2, 3, 4].map(number => ({
  id: 10139 + number,
  season: 1,
  number,
  name: `Episódio ${number}`,
  type: "regular",
  airdate: number === 4 ? "2099-01-01" : "2004-10-01",
}));

// Only the external catalogue is replaced; all HTTP handlers and D1 writes use the built app.
function tvmaze(request) {
  const url = new URL(request.url);
  assert.equal(url.origin, "https://api.tvmaze.com");
  if (url.pathname === "/search/shows" && url.searchParams.get("q") === "Lost") {
    return Response.json([{ show }]);
  }
  if (url.pathname === "/shows/123" && url.searchParams.get("embed") === "episodes") {
    return Response.json({ ...show, _embedded: { episodes } });
  }
  return new Response(null, { status: 404 });
}

test("o próximo episódio acompanha as marcações da mesma pessoa entre sessões", async t => {
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
    outboundService: tvmaze,
  });
  t.after(() => worker.dispose());
  const db = await worker.getD1Database("DB");
  const migrations = join(webRoot, "drizzle");
  for (const file of (await readdir(migrations)).filter(file => file.endsWith(".sql")).sort()) {
    const sql = await readFile(join(migrations, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.prepare(statement.trim()).run();
    }
  }

  function session(id) {
    return async (path, method = "GET", expectedStatus = 200) => {
      // Sites supplies these at dispatch. This local Worker has synthetic identities only.
      const headers = id ? { "oai-authenticated-user-id": id, "oai-authenticated-user-email": `${id}@example.test` } : {};
      const response = await worker.dispatchFetch(`https://watchfolio.test${path}`, { method, headers });
      const body = await response.text();
      assert.equal(response.status, expectedStatus, `${method} ${path}: ${body.slice(0, 300)}`);
      return JSON.parse(body);
    };
  }

  const phone = session("titular");
  const library = "/api/library";
  await session(null)(library, "GET", 401);
  assert.deepEqual(await phone(library), { shows: [], watched: {} });
  const { shows } = await phone("/api/catalog/search?q=Lost");
  assert.equal(shows[0].id, show.id);
  const detail = await phone(`/api/catalog/${show.id}`);
  const [first, second, third, future] = detail.episodes;
  assert.equal(future.available, false);
  const mark = episode => `${library}/${show.id}/episodes/${episode.id}`;

  await phone(mark(second), "PUT");
  assert.equal(nextEpisode(detail.episodes, (await phone(library)).watched[show.id]).id, first.id);
  await Promise.all([phone(mark(first), "PUT"), phone(mark(first), "PUT")]);

  const computer = session("titular");
  const restored = await computer(library);
  assert.equal(restored.shows.length, 1);
  assert.deepEqual(restored.watched[show.id], [first.id, second.id]);
  assert.equal(nextEpisode(detail.episodes, restored.watched[show.id]).id, third.id);
  assert.deepEqual(await session("outro")(library), { shows: [], watched: {} });

  await computer(mark(future), "PUT", 409);
  await computer(mark(third), "PUT");
  assert.equal(nextEpisode(detail.episodes, (await phone(library)).watched[show.id]), undefined);
  await computer(mark(first), "DELETE");
  await computer(mark(first), "DELETE");
  const final = await phone(library);
  assert.deepEqual(final.watched[show.id], [second.id, third.id]);
  assert.equal(nextEpisode(detail.episodes, final.watched[show.id]).id, first.id);
});
