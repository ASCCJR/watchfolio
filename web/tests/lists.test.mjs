import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";

function catalog(request) {
  const url = new URL(request.url);
  if (url.hostname === "api.tvmaze.com") {
    if (url.pathname === "/shows/42/episodes") return Response.json([]);
    if (url.pathname === "/shows/42") return Response.json({ id: 42, name: "Anime de teste", genres: ["Anime"] });
  }
  if (url.hostname === "www.wikidata.org" && url.searchParams.get("action") === "wbgetentities") {
    return Response.json({ entities: { Q220741: { id: "Q220741", labels: { pt: { value: "Filme de teste" } },
      claims: { P31: [{ rank: "normal", mainsnak: { datavalue: { value: { id: "Q11424" } } } }] } } } });
  }
  return Response.json({}, { status: 404 });
}

test("listas mistas preservam a ordem, o histórico e a privacidade entre sessões", async t => {
  const { session } = await startWorker(t, { outboundService: catalog });
  const owner = session("dona"), guest = session("visitante");
  const id = "da01f568-b01a-4101-aef7-3a0277cd2e0a";
  const path = "/api/lists/" + id;
  const movie = "wikidata-Q220741", anime = "tvmaze-42";
  const lists = async () => (await owner("/api/lists")).lists;
  const amend = (revision, data, status = 200) => owner(path, "PATCH", status, { revision, ...data });
  await session(null)("/api/lists", "GET", 401);
  await owner("/api/lists", "POST", 200, { id, name: "Fim de semana" });
  await owner("/api/lists", "POST", 200, { id, name: "Fim de semana" });
  assert.equal((await lists()).length, 1);
  await amend(1, { action: "add", key: movie });
  await amend(2, { action: "add", key: anime });
  await amend(2, { action: "remove", key: movie }, 409);
  await guest(path, "PATCH", 404, { revision: 3, action: "remove", key: movie });
  assert.deepEqual((await guest("/api/lists")).lists, []);
  await amend(3, { action: "up", key: anime });
  await amend(4, { action: "rename", name: "Favoritos" });
  const reopened = (await session("dona")("/api/lists")).lists[0];
  assert.equal(reopened.name, "Favoritos");
  assert.deepEqual(reopened.titles.map(title => title.key), [anime, movie]);
  await owner("/api/shelf/" + movie, "PUT", 200, { status: "planned" });
  await amend(5, { action: "remove", key: movie });
  assert.deepEqual((await lists())[0].titles.map(title => title.key), [anime]);
  assert.equal((await owner("/api/shelf")).entries.find(entry => entry.title.key === movie).status, "planned");
  await owner(path + "?revision=6", "DELETE");
  assert.deepEqual(await lists(), []);
});
