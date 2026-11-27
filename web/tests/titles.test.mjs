import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";

const claim = value => ({ rank: "normal", mainsnak: { datavalue: { value } } });
const film = {
  id: "Q155653",
  labels: { en: { value: "Spirited Away" }, "pt-br": { value: "A Viagem de Chihiro" } },
  claims: {
    P31: [claim({ id: "Q20650540" })],
    P577: [claim({ time: "+2001-00-00T00:00:00Z", precision: 9 })],
    P3383: [claim("Poster.jpg")],
  },
};

test("a busca preserva as fontes, o tipo do longa de anime e a licença da imagem", async t => {
  let wikidataAvailable = true;
  let license = "Public domain";
  const { session } = await startWorker(t, {
    outboundService(request) {
      const url = new URL(request.url);
      if (url.hostname === "api.tvmaze.com") return Response.json([{ show: {
        id: 2, name: "Outro anime", status: "Running", genres: ["Anime"],
      } }]);
      if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: { 1: {
        title: "File:Poster.jpg", imageinfo: [{ thumburl: "https://thumb.wikimedia.org/example.jpg",
          extmetadata: { LicenseShortName: { value: license } } }],
      } } } });
      if (url.hostname !== "www.wikidata.org" || !wikidataAvailable) return new Response(null, { status: 503 });
      if (url.searchParams.get("list") === "search") return Response.json({ query: { search: [{ title: film.id }] } });
      if (url.searchParams.get("ids") === film.id) return Response.json({ entities: { [film.id]: film } });
      return Response.json({ entities: { Q1: { id: "Q1", labels: { en: { value: "Universe" } } } } });
    },
  });
  const get = session();
  const query = "/api/titles/search?q=A%20Viagem%20de%20Chihiro&type=anime";
  const { titles } = await get(query);
  assert.deepEqual(titles.map(title => [title.key, title.name, title.kind]), [
    ["wikidata-Q155653", "A Viagem de Chihiro", "movie"], ["tvmaze-2", "Outro anime", "anime"],
  ]);
  assert.deepEqual(titles[0].genres, ["Anime"]);
  assert.equal(titles[0].year, "2001");
  assert.equal(titles[0].productionStatus, "Lançado");
  assert.equal(titles[0].image, "https://thumb.wikimedia.org/example.jpg");
  assert.equal(titles[0].sourceUrl, "https://www.wikidata.org/wiki/Q155653");
  assert.equal(titles[1].productionStatus, "Em exibição");

  license = "CC BY-SA 4.0";
  const detail = await get("/api/titles/wikidata-Q155653");
  assert.equal(detail.title.image, null);
  assert.deepEqual(detail.episodes, []);
  await get("/api/titles/wikidata-Q1", "GET", 404);
  await get("/api/titles/wikidata-teste", "GET", 400);
  await get("/api/titles/search?q=Chihiro&type=invalido", "GET", 400);
  await get("/api/titles/search?type=all", "GET", 400);

  wikidataAvailable = false;
  const partial = await get(query);
  assert.deepEqual(partial.titles.map(title => title.key), ["tvmaze-2"]);
  assert.match(partial.warnings[0], /Wikidata/);
  await get("/api/titles/search?q=Chihiro&type=movie", "GET", 502);
});

test("a descoberta preserva as faixas de cada catálogo quando a outra fonte retorna uma página curta", async t => {
  const { session } = await startWorker(t, {
    outboundService(request) {
      const url = new URL(request.url);
      if (url.hostname === "api.tvmaze.com") {
        if (url.searchParams.get("page") !== "0") return new Response(null, { status: 404 });
        return Response.json([{ id: 1, name: "Um", genres: [] }, { id: 27, name: "Vinte e sete", genres: [] }]);
      }
      const offset = url.searchParams.get("sroffset");
      if (offset === "0") return Response.json({ query: { search: [] }, continue: { sroffset: 6 } });
      if (offset === "6") return Response.json({ query: { search: [{ title: film.id }] } });
      if (url.searchParams.get("ids") === film.id) return Response.json({ entities: { [film.id]: film } });
      if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: {} } });
      return Response.json({ query: { search: [] } });
    },
  });
  const get = session();
  const first = await get("/api/titles/browse?type=all&page=0");
  assert.deepEqual(first.titles.map(title => title.key), ["tvmaze-1"]);
  assert.equal(first.hasMore, true);
  const second = await get("/api/titles/browse?type=all&page=1");
  assert.deepEqual(second.titles.map(title => title.key), ["tvmaze-27", "wikidata-Q155653"]);
  const last = await get("/api/titles/browse?type=all&page=10");
  assert.deepEqual(last, { titles: [], hasMore: false });
  const beyondWikidata = await get("/api/titles/browse?type=movie&page=1667");
  assert.deepEqual(beyondWikidata, { titles: [], hasMore: false });
  await get("/api/titles/browse?page=-1", "GET", 400);
});
