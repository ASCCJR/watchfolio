import { libraryJson, withLibraryUser } from "@/app/api/library/response";
import { readObject } from "@/app/api/shelf/input";
import { readReaction, staleReaction, writeReaction, type ReactionChange } from "@/db/reactions";
import { ShelfError } from "@/db/shelf-types";
import { getCharacters } from "@/lib/characters";
import { emotions, type Emotion } from "@/lib/reaction-types";
import { getTitle } from "@/lib/titles";

type Context = { params: Promise<{ key: string; target: string }> };

function targetId(key: string, target: string) {
  if (/^wikidata-Q[1-9]\d{0,14}$/.test(key) && target === "movie") return 0;
  if (/^tvmaze-[1-9]\d{0,14}$/.test(key) && /^[1-9]\d{0,14}$/.test(target)) return Number(target);
  throw new ShelfError(400, "Identificador de filme ou episódio inválido.");
}

function localDate(timeZone: unknown) {
  if (typeof timeZone !== "string" || timeZone.length > 100 || !timeZone) {
    throw new ShelfError(400, "Fuso horário inválido.");
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date());
    const value = (type: string) => parts.find(part => part.type === type)!.value;
    return [value("year"), value("month"), value("day")].join("-");
  } catch { throw new ShelfError(400, "Fuso horário inválido."); }
}

function parseChoices(body: Record<string, unknown>) {
  const { revision, rating, emotion, characterId } = body;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) {
    throw new ShelfError(400, "Versão da reação inválida.");
  }
  if (rating !== null && (typeof rating !== "number" || !Number.isInteger(rating * 2) || rating < 0.5 || rating > 5)) {
    throw new ShelfError(400, "Escolha uma nota de meia a cinco estrelas.");
  }
  if (emotion !== null && !emotions.includes(emotion as Emotion)) throw new ShelfError(400, "Emoção inválida.");
  if (characterId !== null && (typeof characterId !== "string" || !/^(tvmaze-[1-9]\d*|wikidata-Q[1-9]\d*)$/.test(characterId) || characterId.length > 40)) {
    throw new ShelfError(400, "Personagem inválido.");
  }
  return { revision, rating, emotion: emotion as Emotion | null, characterId, date: localDate(body.timeZone ?? "UTC") };
}

export function GET(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, target } = await params;
    const episode = targetId(key, target);
    if (new URL(request.url).searchParams.get("cast") === "1") return libraryJson(await getCharacters(key, episode));
    return libraryJson((await readReaction(owner, key, episode)).reaction);
  });
}

export function PUT(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, target } = await params;
    const episode = targetId(key, target);
    const choices = parseChoices(await readObject(request));
    const { reaction, titleName } = await readReaction(owner, key, episode);
    const changes: ReactionChange[] = [];
    if (choices.rating !== reaction.rating) {
      changes.push({ field: "rating", value: choices.rating === null ? null : String(choices.rating) });
    }
    if (choices.emotion !== reaction.emotion) changes.push({ field: "emotion", value: choices.emotion });
    const characterChanged = choices.characterId !== (reaction.character?.id ?? null);
    if (!changes.length && !characterChanged) return libraryJson(reaction);
    if (reaction.revision !== choices.revision) throw staleReaction();
    let name = titleName;
    if (!name) {
      const detail = await getTitle(key);
      if (episode && !detail.episodes.some(item => item.id === episode && item.available)) {
        throw new ShelfError(400, "Escolha um episódio já exibido deste título.");
      }
      name = detail.title.name;
    }
    if (characterChanged) {
      if (choices.characterId === null) changes.push({ field: "character", value: null });
      else {
        const cast = await getCharacters(key, episode);
        const character = cast.characters.find(item => item.id === choices.characterId);
        if (!character) throw new ShelfError(cast.warning ? 503 : 400, cast.warning ?? "Escolha um personagem do elenco deste título.");
        changes.push({ field: "character", value: character.id, label: character.name });
      }
    }
    await writeReaction(owner, key, episode, name, choices.date, choices.revision, changes);
    return libraryJson((await readReaction(owner, key, episode)).reaction);
  });
}
