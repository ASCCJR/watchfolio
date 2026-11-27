import { maxPhotoBytes, palettes, type MemeRecipe } from "@/lib/artwork";

const memeWidth = 800, memeHeight = 600;

function openImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    image.src = url;
  });
}

function cover(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  const { width, height } = context.canvas;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

export async function preparePhoto(file: File, poster: boolean) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Escolha um arquivo JPEG, PNG ou WebP.");
  if (file.size > 16 * 1024 * 1024) throw new Error("Escolha uma imagem de até 16 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await openImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = poster ? 480 : memeWidth;
    canvas.height = poster ? 720 : memeHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
    ctx.fillStyle = "#191c19"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    cover(ctx, image);
    for (const quality of [.86, .7, .54, .38, .22]) {
      const photo = canvas.toDataURL("image/webp", quality);
      if (!photo.startsWith("data:image/webp;base64,")) break;
      if ((photo.length - "data:image/webp;base64,".length) * .75 <= maxPhotoBytes) return photo;
    }
    throw new Error("Não foi possível compactar a imagem. Tente uma imagem menor no Chrome ou no Edge.");
  } finally { URL.revokeObjectURL(url); }
}

function wrapCaption(ctx: CanvasRenderingContext2D, caption: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  // Captions can include a long word, emoji, or text without spaces.
  for (const word of caption.trim().replace(/\s+/g, " ").split(" ")) {
    const joined = line ? line + " " + word : word;
    if (ctx.measureText(joined).width <= maxWidth) { line = joined; continue; }
    if (line) lines.push(line);
    line = "";
    for (const letter of word) {
      if (line && ctx.measureText(line + letter).width > maxWidth) { lines.push(line); line = ""; }
      line += letter;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draw in an offscreen canvas first so that a slower image decode can never
// overwrite a newer draft in the visible preview.
export async function renderMeme(recipe: MemeRecipe) {
  const canvas = document.createElement("canvas");
  canvas.width = memeWidth; canvas.height = memeHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu abrir a prévia.");
  if (recipe.photo) cover(ctx, await openImage(recipe.photo));
  else {
    const palette = palettes[recipe.palette];
    const gradient = ctx.createLinearGradient(90, 10, 700, 600);
    gradient.addColorStop(0, palette.start); gradient.addColorStop(1, palette.end);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, memeWidth, memeHeight);
    ctx.save(); ctx.translate(610, 170); ctx.rotate(-.35);
    ctx.strokeStyle = palette.light; ctx.lineWidth = 3; ctx.globalAlpha = .7;
    for (let radius = 48; radius < 480; radius += 20) {
      ctx.beginPath(); ctx.ellipse(0, 0, radius * .65, radius, 0, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }
  if (recipe.caption.trim()) {
    const shade = ctx.createLinearGradient(0, 150, 0, memeHeight);
    shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.86)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, memeWidth, memeHeight);
    let fontSize = 56;
    ctx.font = "bold " + fontSize + "px Arial, sans-serif";
    let lines = wrapCaption(ctx, recipe.caption, memeWidth - 90);
    while (lines.length * fontSize * 1.16 > memeHeight * .55 && fontSize > 24) {
      fontSize -= 2; ctx.font = "bold " + fontSize + "px Arial, sans-serif";
      lines = wrapCaption(ctx, recipe.caption, memeWidth - 90);
    }
    const step = Math.ceil(fontSize * 1.16);
    ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2;
    lines.forEach((line, i) => ctx.fillText(line, memeWidth / 2, memeHeight - 32 - (lines.length - 1 - i) * step));
  }
  return canvas;
}

export function pngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) { reject(new Error("O navegador não conseguiu exportar o PNG.")); return; }
    resolve(blob);
  }, "image/png"));
}
