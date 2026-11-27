import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";

const filmKey = "wikidata-Q8";
const showKey = "tvmaze-123";
const show = { id: 123, name: "Série de teste", genres: ["Drama"] };
const episodes = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, season: 1, number: index + 1, name: "Capítulo " + (index + 1),
  type: "regular", airdate: "2000-01-01", runtime: index === 1 ? null : 42,
}));
const claim = (value, rank = "normal") => ({ rank, mainsnak: { datavalue: { value } } });
const quantity = (amount, unit) => ({ amount, unit: "http://www.wikidata.org/entity/" + unit });
const film = { id: "Q8", labels: { pt: { value: "Filme" } },
  claims: { P31: [claim({ id: "Q11424" })], P136: [claim({ id: "Q9" })], P2047: [claim(quantity("+1.5", "Q25235"))] } };

function catalogue(request) {
  const url = new URL(request.url);
  if (url.hostname === "api.tvmaze.com" && url.pathname === "/shows/123") return Response.json({ ...show, _embedded: { episodes } });
  if (url.hostname === "api.tvmaze.com" && url.pathname === "/shows/123/episodes") return Response.json(episodes);
  if (url.hostname === "www.wikidata.org" && url.searchParams.get("ids") === "Q8") return Response.json({ entities: { Q8: film } });
  if (url.hostname === "www.wikidata.org" && url.searchParams.get("ids") === "Q9") return Response.json({ entities: { Q9: { labels: { pt: { value: "drama" } } } } });
  return new Response(null, { status: 404 });
}

test("atividade privada soma durações de sessões, distingue anos, recalcula votos e medalhas e pagina o histórico", async t => {
  const { session, db } = await startWorker(t, { outboundService: catalogue });
  const person = session("titular");
  const activity = "/api/activity";
  const watch = (key, operation, episodeIds, watchedOn, rewatch = false) =>
    person("/api/shelf/" + key + "/watches/" + operation, "PUT", 200, { episodeIds, watchedOn, rewatch });
  const undo = (key, operation) => person("/api/shelf/" + key + "/watches/" + operation, "DELETE");
  await session(null)(activity, "GET", 401);
  await person(activity + "?year=202", "GET", 400);
  await person(activity + "?page=-1", "GET", 400);
  assert.deepEqual((await person(activity)).medals, { first: 0, episodes: 0, characters: 0 });
  await watch(filmKey, "filme", [null], "2022-12-31");
  await watch(filmKey, "filme2", [null], "2023-01-01", true);
  await watch(showKey, "dois", [1, 2], "2023-01-02");
  const annual = () => person(activity + "?year=2023");
  const january = await annual();
  assert.deepEqual(january.totals, { sessions: 3, titles: 2, movies: 1, episodes: 2, rewatches: 1,
    seconds: (90 + 42) * 60, missingRuntime: 1, ratings: 0, meanRating: null });
  assert.equal(january.history.find(row => row.episodeId === 1).episodeLabel, "T1 · E01 · Capítulo 1");
  assert.equal(january.history.find(row => row.episodeId === 2).seconds, null);
  assert.deepEqual(january.missingTitles, [{ key: showKey, name: show.name }]);
  assert.deepEqual(january.genres, [{ name: "Drama", count: 3 }]);
  assert.equal(january.titles[0].key, showKey);
  const oneDay = await person(activity + "?year=2023&day=2023-01-02");
  assert.deepEqual(oneDay.totals, january.totals);
  assert.equal(oneDay.historyCount, 2);
  assert.equal(oneDay.history.length, 2);
  assert.equal((await person(activity + "?day=2024-01-02")).historyCount, 0);
  assert.equal((await person(activity + "?year=2099&day=2099-12-31")).historyCount, 0);
  await person(activity + "?day=2025-02-29", "GET", 400);
  await person(activity + "?year=2022&day=2023-01-02", "GET", 400);
  assert.deepEqual(january.years, [2023, 2022]);
  assert.equal((await person(activity)).totals.seconds, (90 + 90 + 42) * 60);
  assert.deepEqual((await session("outro")(activity)).history, []);

  const firstFilm = "/api/shelf/" + filmKey + "/sessions/filme%3Amovie";
  await person(firstFilm, "PATCH", 200, { watchedOn: "2024-10-01" });
  assert.equal((await annual()).totals.rewatches, 0);
  assert.equal((await person(activity + "?year=2022")).totals.sessions, 0);
  assert.equal((await person(activity + "?year=2024")).totals.rewatches, 1);

  // Fixed local calendar dates stand in for reactions across two calendar years.
  const log = (episode, field, value, label, date) => db.prepare(
    "INSERT INTO reaction_events (owner_id,title_key,episode_id,title_name,field,value,label,reacted_on) VALUES (?,?,?,?,?,?,?,?)")
    .bind("titular", showKey, episode, show.name, field, value, label, date).run();
  await log(1, "character", "tvmaze-50", "Lia", "2022-12-31");
  await log(1, "character", "tvmaze-55", "Eva", "2023-01-01");
  await log(2, "character", "tvmaze-55", "Eva", "2023-01-02");
  await log(1, "rating", "5", null, "2022-12-31");
  await log(1, "rating", "3.5", null, "2023-01-01");
  await log(2, "rating", "4.5", null, "2023-01-01");
  await log(2, "emotion", "Alegria", null, "2023-01-01");
  assert.equal((await annual()).medals.characters, 2);
  await log(3, "character", "tvmaze-57", "Lia", "2023-01-03");
  const voted = await annual();
  assert.equal(voted.medals.characters, 3);
  assert.deepEqual(voted.characters, [{ key: "tvmaze-55", name: "Eva", count: 2 }, { key: "tvmaze-57", name: "Lia", count: 1 }]);
  assert.equal(voted.totals.ratings, 2);
  assert.equal(voted.totals.meanRating, 4);
  assert.deepEqual(voted.emotions, [{ name: "Alegria", count: 1 }]);
  const previous = await person(activity + "?year=2022");
  assert.deepEqual(previous.characters, [{ key: "tvmaze-50", name: "Lia", count: 1 }]);
  assert.equal(previous.totals.meanRating, 5);
  await log(3, "character", null, null, "2024-01-01");
  await log(2, "rating", null, null, "2024-01-01");
  assert.equal((await person(activity)).totals.meanRating, 3.5);
  assert.equal((await annual()).medals.characters, 2);
  assert.deepEqual((await annual()).characters, voted.characters);
  assert.deepEqual((await session("outro")(activity)).characters, []);
  const empty = await person(activity + "?year=1998");
  assert.equal(empty.totals.sessions, 0);
  assert.equal(empty.totals.ratings, 0);
  assert.deepEqual(empty.history, []);

  const nine = episodes.slice(0, 9).map(ep => ep.id);
  await watch(showKey, "nove", nine, "2023-02-01");
  assert.equal((await person(activity)).medals.episodes, 9);
  await watch(showKey, "dez", [10], "2023-02-01");
  await watch(showKey, "dez", [10], "2023-02-01");
  assert.equal((await person(activity)).medals.episodes, 10);
  await watch(showKey, "rever-todos", [...nine, 10], "2023-03-01", true);
  const all = await person(activity);
  assert.equal(all.medals.episodes, 10);
  assert.equal(all.history.length, 20);
  const next = await person(activity + "?page=1");
  assert.equal(next.history.length, 2);
  assert.equal(new Set([...all.history, ...next.history].map(row => row.titleKey + row.id)).size, 22);
  await undo(showKey, "rever-todos");
  await undo(showKey, "dez");
  assert.equal((await person(activity)).medals.episodes, 9);
  await undo(showKey, "nove");
  await undo(showKey, "dois");
  await undo(filmKey, "filme");
  await undo(filmKey, "filme2");
  assert.equal((await person(activity)).medals.first, 0);
  await person("/api/library/123/episodes/1", "PUT");
  assert.equal((await person(activity)).history[0].seconds, 42 * 60);
});
