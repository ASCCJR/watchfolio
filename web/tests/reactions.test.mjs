import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";

const claim = value => ({ rank: "normal", mainsnak: { datavalue: { value } } });
const film = {
  id: "Q42", labels: { pt: { value: "Filme de teste" } },
  claims: { P31: [claim({ id: "Q11424" })], P674: [claim({ id: "Q201" })],
    P161: [{ ...claim({ id: "Q901" }), qualifiers: { P453: [{ datavalue: { value: { id: "Q202" } } }] } }] },
};
const empty = { revision: 0, rating: null, emotion: null, character: null };
const put = (reaction, changes) => ({ revision: reaction.revision, rating: reaction.rating, emotion: reaction.emotion,
  characterId: reaction.character?.id ?? null, timeZone: "America/Fortaleza", ...changes });

test("notas, emoções e personagens são privados e preservam escolhas anteriores e votos de cada ano", async t => {
  let castAvailable = true;
  let castEmpty = false;
  let showAvailable = true;
  const { db, session } = await startWorker(t, {
    outboundService(request) {
      const url = new URL(request.url);
      if (url.hostname === "www.wikidata.org") {
        const ids = url.searchParams.get("ids");
        if (ids === "Q42") return Response.json({ entities: { Q42: film } });
        if (ids === "Q201|Q202") return Response.json({ entities: {
          Q201: { labels: { pt: { value: "Maria" } } }, Q202: { labels: { en: { value: "John" } } },
        } });
      }
      if (url.hostname === "api.tvmaze.com") {
        if (url.pathname === "/shows/24/cast") return castAvailable ? Response.json(castEmpty ? [] : [
          { person: { id: 111, name: "Ator" }, character: { id: 201, name: "Alex" } },
          { person: { id: 112, name: "Atriz" }, character: { id: 202, name: "Bia" } },
        ]) : Response.json({}, { status: 503 });
        if (/^\/episodes\/\d+\/guestcast$/.test(url.pathname)) {
          return castAvailable ? Response.json([]) : Response.json({}, { status: 503 });
        }
        if (url.pathname === "/shows/24" && showAvailable) return Response.json({ id: 24, name: "Série de teste" });
        if (url.pathname === "/shows/24/episodes" && showAvailable) return Response.json([
          { id: 7, type: "regular", season: 1, number: 1, name: "Início", airdate: "2020-01-01" },
          { id: 8, type: "regular", season: 1, number: 2, name: "Depois", airdate: "2099-01-01" },
        ]);
      }
      return Response.json({}, { status: 404 });
    },
  });
  const owner = session("tester"), other = session("another");
  const movie = "/api/reactions/wikidata-Q42/movie", episode = "/api/reactions/tvmaze-24/7";
  await session(null)(movie, "GET", 401);
  await session(null)(episode, "PUT", 401, put(empty, { rating: 3 }));
  assert.deepEqual(await owner(movie), empty);
  assert.deepEqual((await owner(movie + "?cast=1")).characters, [
    { id: "wikidata-Q201", name: "Maria" }, { id: "wikidata-Q202", name: "John" },
  ]);
  await owner("/api/reactions/wikidata-Q42/7", "GET", 400);
  await owner("/api/reactions/tvmaze-24/9", "PUT", 400, put(empty, { emotion: "Alegria" }));
  await owner("/api/reactions/tvmaze-24/8", "PUT", 400, put(empty, { rating: 4 }));
  for (const rating of [0, 5.5, 4.25, "1", false]) await owner(movie, "PUT", 400, put(empty, { rating }));
  await owner(movie, "PUT", 400, put(empty, { emotion: "inexistente" }));
  await owner(movie, "PUT", 400, put(empty, { characterId: "wikidata-Q901" }));
  await owner(movie, "PUT", 400, put(empty, { timeZone: "Teste/Inexistente" }));
  const edit = async (path, saved, changes) => owner(path, "PUT", 200, put(saved, changes));
  const first = await edit(movie, empty, { rating: 0.5, emotion: "Medo", characterId: "wikidata-Q201" });
  assert.equal(first.rating, 0.5);
  assert.equal(first.character.name, "Maria");
  const same = await edit(movie, empty, { rating: 0.5, emotion: "Medo", characterId: "wikidata-Q201" });
  assert.deepEqual(same, first);
  await owner(movie, "PUT", 409, put(empty, { emotion: "Tédio" }));
  const changed = await edit(movie, first, { rating: 5, emotion: "Surpresa", characterId: "wikidata-Q202" });
  assert.equal(changed.rating, 5);
  assert.equal(changed.character.name, "John");
  assert.deepEqual(await session("tester")(movie), changed);
  assert.deepEqual(await other(movie), empty);
  const cleared = await edit(movie, changed, { rating: null });
  assert.deepEqual([cleared.rating, cleared.emotion, cleared.character], [null, "Surpresa", changed.character]);

  const oldYear = String(new Date().getUTCFullYear() - 2);
  await db.prepare(`INSERT INTO reaction_events (owner_id, title_key, title_name, episode_id, field, value, label, reacted_on)
    VALUES ('tester','tvmaze-24','Série de teste',7,'character','tvmaze-201','Alex',?)`).bind(oldYear + "-12-31").run();
  const prior = await owner(episode);
  const favorite = await edit(episode, prior, { rating: 4.5, emotion: "Tristeza", characterId: "tvmaze-202" });
  assert.equal(favorite.character.name, "Bia");
  assert.equal(favorite.rating, 4.5);
  const choices = (await db.prepare(`SELECT reacted_on, value FROM reaction_events WHERE owner_id = 'tester'
    AND title_key = 'tvmaze-24' AND field = 'character' ORDER BY id`).all()).results;
  assert.equal(choices[0].reacted_on, oldYear + "-12-31");
  assert.deepEqual(choices.map(row => row.value), ["tvmaze-201", "tvmaze-202"]);
  assert.equal(choices[1].reacted_on, new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Fortaleza" }).format(new Date()));

  castEmpty = true;
  assert.deepEqual(await owner(episode + "?cast=1"), { characters: [] });
  assert.deepEqual((await owner(episode)).character, favorite.character);
  await owner(episode, "PUT", 400, put(favorite, { characterId: "tvmaze-201" }));
  castAvailable = false;
  showAvailable = false;
  await owner(episode + "?cast=1", "GET", 502);
  assert.deepEqual((await owner(episode)).character, favorite.character);
  const revised = await edit(episode, favorite, { rating: 1 });
  assert.deepEqual(revised.character, favorite.character);
  await owner(episode, "PUT", 502, put(revised, { characterId: "tvmaze-201" }));
  assert.equal((await edit(episode, revised, { characterId: null })).character, null);
});
