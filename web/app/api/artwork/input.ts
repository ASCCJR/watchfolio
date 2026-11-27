import { ShelfError } from "@/db/shelf-types";
import { maxPhotoBytes, palettes, type MemeRecipe, type Palette } from "@/lib/artwork";

export function artworkKey(key: string) {
  if (!/^(?:tvmaze-[1-9]\d{0,14}|wikidata-Q[1-9]\d{0,14})$/.test(key)) throw new ShelfError(400, "Título inválido.");
  return key;
}

export function memeId(id: string) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) throw new ShelfError(400, "Identificador de meme inválido.");
  return id;
}

export function revision(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new ShelfError(400, "Versão de imagem inválida.");
  return value;
}

export async function artworkBody(request: Request): Promise<Record<string, unknown>> {
  const limit = 4 * Math.ceil(maxPhotoBytes / 3) + 4096;
  const tooLarge = () => new ShelfError(413, "A imagem ultrapassa o tamanho permitido.");
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new ShelfError(400, "Envie os dados da imagem.");
  let size = 0, raw = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw tooLarge(); }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    const data = JSON.parse(raw + decoder.decode());
    if (data && typeof data === "object" && !Array.isArray(data)) return data;
  } catch { /* Invalid payload is reported below. */ }
  throw new ShelfError(400, "Os dados da imagem são inválidos.");
}

// Accept a single opaque WebP frame. Strip color profiles and other ancillary chunks
// before storage, and bound decoded dimensions independently of the encoded byte length.
export function parsePhoto(value: unknown) {
  const invalid = () => new ShelfError(400, "Escolha novamente a imagem no editor.");
  if (typeof value !== "string" || !value.startsWith("data:image/webp;base64,")) throw invalid();
  const base64 = value.slice("data:image/webp;base64,".length);
  if (!base64 || base64.length > Math.ceil(maxPhotoBytes / 3) * 4) throw invalid();
  let file: string;
  try { file = atob(base64); } catch { throw invalid(); }
  const byte = (i: number) => file.charCodeAt(i);
  const uint32 = (i: number) => byte(i) + 256 * byte(i + 1) + 65536 * byte(i + 2) + 16777216 * byte(i + 3);
  if (file.length > maxPhotoBytes || file.slice(0, 4) !== "RIFF" || uint32(4) !== file.length - 8 || file.slice(8, 12) !== "WEBP") throw invalid();
  let frame = "";
  for (let i = 12; i < file.length;) {
    if (i + 8 > file.length) throw invalid();
    const tag = file.slice(i, i + 4), length = uint32(i + 4), data = i + 8, end = data + length + length % 2;
    if (end > file.length) throw invalid();
    if (tag === "VP8 ") {
      if (frame || length < 11 || (byte(data) & 1) !== 0 || file.slice(data + 3, data + 6) !== "\x9d\x01\x2a") throw invalid();
      const width = (byte(data + 6) + 256 * byte(data + 7)) & 0x3fff;
      const height = (byte(data + 8) + 256 * byte(data + 9)) & 0x3fff;
      if (!width || !height || width > 1024 || height > 1024) throw invalid();
      frame = file.slice(i, end);
    } else if (!["VP8X", "ICCP", "EXIF", "XMP "].includes(tag)) throw invalid();
    i = end;
  }
  if (!frame) throw invalid();
  const size = frame.length + 4;
  const header = "RIFF" + String.fromCharCode(size & 255, size >>> 8 & 255, size >>> 16 & 255, size >>> 24) + "WEBP";
  return "data:image/webp;base64," + btoa(header + frame);
}

export function parseRecipe(value: unknown): MemeRecipe {
  if (!value || typeof value !== "object") throw new ShelfError(400, "Informe a legenda e o fundo.");
  const { caption, photo, palette } = value as Record<string, unknown>;
  if (typeof caption !== "string" || !caption.trim() || caption.length > 120) throw new ShelfError(400, "Escreva uma legenda de até 120 caracteres.");
  if (typeof palette !== "string" || !Object.hasOwn(palettes, palette)) throw new ShelfError(400, "Fundo inválido.");
  return { caption: caption.trim(), palette: palette as Palette, photo: photo === null ? null : parsePhoto(photo) };
}
