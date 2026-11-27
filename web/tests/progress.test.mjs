import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";
import { nextEpisode } from "../lib/progress.ts";

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
  const { session } = await startWorker(t, { outboundService: tvmaze });

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
