import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";

const show = { id: 123, name: "Lost", genres: ["Drama"], status: "Ended", premiered: "2004-09-22" };
const episodes = [
  { id: 11, number: 1, type: "regular", airdate: "2004-09-22", runtime: 44 },
  { id: 12, number: 2, type: "regular", airdate: "2004-09-29" },
  { id: 13, number: null, type: "significant_special", airdate: "2004-10-02" },
  { id: 14, number: 3, type: "regular", airdate: "2099-12-01" },
].map(episode => ({ ...episode, name: `Episode ${episode.id}`, season: 1 }));

function catalogue(request) {
  const url = new URL(request.url);
  if (url.origin === "https://api.tvmaze.com" && url.pathname === "/shows/123") {
    return Response.json({ ...show, _embedded: { episodes } });
  }
  if (url.origin === "https://api.tvmaze.com" && url.pathname === "/shows/123/episodes") {
    return Response.json(episodes);
  }
  if (url.origin === "https://www.wikidata.org" && url.searchParams.get("ids") === "Q220741") {
    return Response.json({ entities: { Q220741: {
      id: "Q220741", labels: { pt: { language: "pt", value: "Cidade de Deus" } },
      claims: { P31: [{ rank: "normal", mainsnak: { datavalue: { value: { id: "Q11424" } } } }] },
    } } });
  }
  return Response.json({ error: "unknown catalog fixture" }, { status: 404 });
}

async function seedVersionOne(db, filename) {
  if (!filename.startsWith("0001")) return;
  const snapshot = { id: 123, name: "Lost", image: null, year: "2004", genres: ["Drama"], sourceUrl: "https://www.tvmaze.com/shows/123/lost" };
  await db.prepare("INSERT INTO library_tvmaze_shows (owner_id, show_id, details) VALUES (?, ?, ?)")
    .bind("titular", 123, JSON.stringify(snapshot)).run();
  await db.prepare("INSERT INTO watched_tvmaze_episodes (owner_id, show_id, episode_id, watched_at) VALUES (?, ?, ?, ?)")
    .bind("titular", 123, 11, "2020-06-15 22:33:44").run();
}

test("a biblioteca preserva o histórico antigo, desfaz somente as sessões do lote e mantém reassistidas", async t => {
  const { session } = await startWorker(t, { outboundService: catalogue, beforeMigration: seedVersionOne });
  const person = session("titular");
  const other = session("visitante");
  const series = "/api/shelf/tvmaze-123";
  const movie = "/api/shelf/wikidata-Q220741";
  const history = async key => (await person("/api/shelf")).entries.find(entry => entry.title.key === key);
  await session(null)("/api/shelf", "GET", 401);
  const [first, oldDevice] = await Promise.all([history("tvmaze-123"), person("/api/library")]);
  assert.deepEqual(oldDevice.watched, { 123: [11] });
  assert.equal(first.status, "watching");
  assert.equal(first.sessions.length, 1);
  assert.equal(first.sessions[0].watchedOn, "2020-06-15");
  assert.deepEqual(await other("/api/shelf"), { entries: [] });

  const originalSession = `${series}/sessions/${encodeURIComponent(first.sessions[0].id)}`;
  await other(originalSession, "PATCH", 404, { watchedOn: "2021-01-01" });
  await person(originalSession, "PATCH", 400, { watchedOn: "2021-02-29" });
  await person(originalSession, "PATCH", 200, { watchedOn: "2020-06-14" });
  const batch = { episodeIds: [11, 12, 13], watchedOn: "2021-01-01" };
  await person(`${series}/watches/bad`, "PUT", 409, { ...batch, episodeIds: [12, 14] });
  assert.equal((await history("tvmaze-123")).sessions.length, 1);
  const applyBatch = () => person(`${series}/watches/batch-1`, "PUT", 200, batch);
  await Promise.all([applyBatch(), applyBatch()]);
  assert.equal((await history("tvmaze-123")).sessions.length, 3);
  assert.deepEqual((await person("/api/library")).watched[123], [11, 12, 13]);
  await person(`${series}/watches/batch-1`, "PUT", 409, { ...batch, watchedOn: "2021-01-02" });
  const again = { episodeIds: [12], watchedOn: "2022-04-02", rewatch: true };
  await person(`${series}/watches/replay`, "PUT", 200, again);
  await person(`${series}/watches/replay`, "PUT", 200, again);
  await person("/api/library/123/episodes/12", "DELETE", 409);
  await person(`${series}/watches/batch-1`, "DELETE");
  await applyBatch(); // an old request retried after undo
  assert.deepEqual((await history("tvmaze-123")).sessions.map(s => [s.episodeId, s.watchedOn]), [
    [12, "2022-04-02"], [11, "2020-06-14"],
  ]);
  await person(originalSession, "DELETE");
  assert.deepEqual((await person("/api/library")).watched[123], [12]);
  await Promise.all([
    person("/api/library/123/episodes/11", "PUT"),
    person(`${series}/watches/simultaneous`, "PUT", 200, { ...batch, episodeIds: [11] }),
  ]);
  assert.deepEqual((await history("tvmaze-123")).sessions.map(s => s.episodeId).sort(), [11, 12]);
  for (const status of ["planned", "watching", "paused", "completed", "dropped"]) {
    await person(series, "PUT", 200, { status });
    assert.equal((await history("tvmaze-123")).status, status);
  }
  await person(series, "DELETE");
  assert.equal((await history("tvmaze-123")).status, null);
  assert.equal((await history("tvmaze-123")).sessions.length, 2);
  assert.deepEqual(await person("/api/library"), { shows: [], watched: {} });
  const stored = (await history("tvmaze-123")).sessions;
  await person(series, "PUT", 200, { status: "paused" });
  assert.deepEqual((await history("tvmaze-123")).sessions, stored);
  assert.deepEqual((await person("/api/library")).watched, { 123: [11, 12] });

  const filmInput = { episodeIds: [null], watchedOn: "2024-06-01" };
  await person(`${movie}/watches/first`, "PUT", 200, filmInput);
  await person(`${movie}/watches/normal-retry`, "PUT", 200, filmInput);
  const rewatch = { ...filmInput, watchedOn: "2025-07-01", rewatch: true };
  await person(`${movie}/watches/replay`, "PUT", 200, rewatch);
  await person(`${movie}/watches/replay`, "PUT", 200, rewatch);
  const film = await history("wikidata-Q220741");
  assert.equal(film.status, "completed");
  assert.deepEqual(film.sessions.map(s => [s.episodeId, s.watchedOn]), [[null, "2025-07-01"], [null, "2024-06-01"]]);
  await other(`${movie}/watches/replay`, "DELETE");
  assert.deepEqual((await history("wikidata-Q220741")).sessions, film.sessions);
  await person(`${movie}/sessions/${encodeURIComponent(film.sessions[0].id)}`, "DELETE");
  assert.equal((await history("wikidata-Q220741")).sessions.length, 1);
});

test("a consulta de duração completa uma sessão antiga somente para seu titular", async t => {
  const { db, session } = await startWorker(t, { outboundService: catalogue, beforeMigration: seedVersionOne });
  const route = "/api/activity/durations/tvmaze-123";
  await session(null)(route, "POST", 401);
  assert.deepEqual(await session("visitante")(route, "POST"), { updated: 0 });
  const owner = session("titular");
  await owner("/api/shelf/tvmaze-123/watches/lote", "PUT", 200, { episodeIds: [11, 12], rewatch: true, watchedOn: "2024-02-20" });
  const updated = await Promise.all([owner(route, "POST"), owner(route, "POST")]);
  assert.equal(updated[0].updated + updated[1].updated, 1);
  const rows = await db.prepare("SELECT episode_id, duration_seconds, watched_on FROM watch_sessions ORDER BY id").all();
  assert.deepEqual(rows.results.map(row => [row.episode_id, row.duration_seconds, row.watched_on]), [
    [11, 2640, "2020-06-15"], [11, 2640, "2024-02-20"], [12, null, "2024-02-20"],
  ]);
});
