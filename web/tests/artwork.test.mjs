import assert from "node:assert/strict";
import test from "node:test";
import { startWorker } from "./worker.mjs";

// A 12 × 16 opaque WebP generated for this test.
const photo = "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoMABAAAcAsJQBOgCgAAP70iIMMJgnXr1pbm3EAAAA=";
const key = "wikidata-Q220741", otherKey = "tvmaze-123", id = "9904c585-cc1c-4892-8014-9e0545a45034";

test("pôster e meme privados persistem por título, preservam alterações concorrentes e podem ser restaurados", async t => {
  const { session } = await startWorker(t, { outboundService: () => Response.json({}, { status: 404 }) });
  const owner = session("artista"), guest = session("outra-pessoa");
  const poster = "/api/artwork/" + key + "/poster", memes = "/api/artwork/" + key + "/memes", path = memes + "/" + id;
  const recipe = { caption: "Mais um episódio", palette: "ember", photo };
  await session(null)("/api/artwork", "GET", 401);
  await owner(poster, "PUT", 400, { revision: null, photo: "data:image/svg+xml,<svg/>" });
  await owner(poster, "PUT", 413, { revision: null, photo: "0".repeat(145000) });
  const first = await owner(poster, "PUT", 200, { revision: null, photo });
  assert.equal((await owner("/api/artwork")).posters[key], first.revision);
  assert.equal((await owner(poster, "PUT", 200, { revision: null, photo })).revision, first.revision);
  assert.deepEqual((await guest("/api/artwork")).posters, {});
  await guest(poster, "GET", 404);
  await owner(poster + "?revision=" + "a".repeat(64), "DELETE", 409);
  await guest(poster + "?revision=" + first.revision, "DELETE");
  assert.equal((await owner("/api/artwork")).posters[key], first.revision);
  await owner(poster + "?revision=" + first.revision, "DELETE");
  assert.deepEqual((await owner("/api/artwork")).posters, {});
  await owner(poster, "GET", 404);

  await owner(path, "PUT", 400, { revision: null, recipe: { ...recipe, caption: "  " } });
  await owner(path, "PUT", 400, { revision: null, recipe: { ...recipe, palette: "__proto__" } });
  await owner(path, "PUT", 400, { revision: null, recipe: { ...recipe, photo: "https://example.org/private-photo.jpg" } });
  const saved = await owner(path, "PUT", 200, { revision: null, recipe });
  assert.deepEqual((await session("artista")(path)).recipe, recipe);
  assert.deepEqual((await owner("/api/artwork/" + otherKey + "/memes")).memes, []);
  assert.deepEqual((await guest(memes)).memes, []);
  await guest(path, "GET", 404);
  assert.equal((await owner(memes)).memes[0].caption, recipe.caption);
  const editedRecipe = { ...recipe, photo: null, caption: "À espera da próxima temporada" };
  const edited = await owner(path, "PUT", 200, { revision: saved.revision, recipe: editedRecipe });
  await owner(path, "PUT", 409, { revision: saved.revision, recipe });
  assert.deepEqual((await session("artista")(path)).recipe, editedRecipe);
  await owner(path + "?revision=" + saved.revision, "DELETE", 409);
  await owner(path + "?revision=" + edited.revision, "DELETE");
  assert.deepEqual((await owner(memes)).memes, []);
});
