import { CatalogError, fetchCatalog } from "./catalog";
import { getMovieCharacters } from "./wikidata";
import type { Cast, Character } from "./reaction-types";

function castCharacters(data: unknown): Character[] {
  if (!Array.isArray(data)) throw new CatalogError(502, "O TVmaze não retornou o elenco.");
  const roles: Character[] = [];
  for (const credit of data) {
    const role = credit?.character;
    if (Number.isSafeInteger(role?.id) && role.id > 0 && typeof role.name === "string" && role.name.trim()) {
      roles.push({ id: "tvmaze-" + role.id, name: role.name });
    }
  }
  return roles;
}

export async function getCharacters(key: string, episode: number): Promise<Cast> {
  if (key.startsWith("wikidata-")) return { characters: await getMovieCharacters(key.slice(9)) };
  const showId = key.slice(7);
  const [main, guests] = await Promise.allSettled([
    fetchCatalog(`/shows/${showId}/cast`).then(castCharacters),
    fetchCatalog(`/episodes/${episode}/guestcast`).then(castCharacters),
  ]);
  if (main.status === "rejected" && guests.status === "rejected") {
    throw new CatalogError(502, "O elenco está indisponível no TVmaze.");
  }
  const roles = [...(main.status === "fulfilled" ? main.value : []), ...(guests.status === "fulfilled" ? guests.value : [])];
  const characters = [...new Map(roles.map(role => [role.id, role])).values()];
  return { characters, ...(main.status === "rejected" || guests.status === "rejected"
    ? { warning: "O TVmaze retornou apenas parte do elenco." } : {}) };
}
