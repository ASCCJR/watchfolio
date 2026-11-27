"use client";

import { useRef, useState } from "react";
import { ImagePlus, Palette } from "lucide-react";
import { artworkPath } from "@/lib/artwork";
import type { Title } from "@/lib/titles";
import { request } from "../use-resource";
import { preparePhoto } from "./drawing";
import { MemeEditor } from "./meme-editor";
import { usePersonalPoster, usePosterIndex } from "./posters";
import "./studio.css";

export function ArtworkPanel({ title }: { title: Title }) {
  const [section, setSection] = useState<"poster" | "meme" | null>(null);
  return <section className="artwork-panel" id="imagens" aria-labelledby="art-heading">
    <div className="section-heading"><h2 id="art-heading">Pôster e memes</h2></div>
    <div className="art-buttons">
      <button type="button" className="button plain" aria-expanded={section === "poster"} onClick={() => setSection(section === "poster" ? null : "poster")}><ImagePlus size={18} aria-hidden="true" />Meu pôster</button>
      <button type="button" className="button plain" aria-expanded={section === "meme"} onClick={() => setSection(section === "meme" ? null : "meme")}><Palette size={18} aria-hidden="true" />Meus memes</button>
    </div>
    {section === "poster" && <PosterEditor title={title} />}
    {section === "meme" && <MemeEditor title={title} />}
  </section>;
}

function PosterEditor({ title }: { title: Title }) {
  const { index, refresh } = usePosterIndex();
  const current = index?.posters[title.key] ?? null, personal = usePersonalPoster(title.key);
  const [draft, setDraft] = useState<{ photo: string; revision: string | null } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const image = draft?.photo ?? personal ?? title.image;

  async function choose(file: File) {
    setBusy(true); setMessage(""); setError("");
    try { setDraft({ photo: await preparePhoto(file, true), revision: current }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao abrir o arquivo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function save(restore: boolean) {
    if (busy || (restore ? !current : !draft)) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const path = artworkPath(title.key) + "/poster";
      if (restore) await request(path + "?revision=" + current, { method: "DELETE" });
      else await request(path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      setDraft(null);
      setMessage(restore ? "Pôster do catálogo restaurado." : "Seu pôster foi salvo.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao salvar o pôster."); }
    finally { await refresh(); setBusy(false); }
  }
  return <div className="art-editor poster-editor">
    <div className="poster-choice">{image ? <img src={image} alt={"Prévia do pôster de " + title.name} /> : <ImagePlus size={35} aria-hidden="true" />}</div>
    <div className="art-form">
      <label>Escolher imagem para o pôster
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void choose(file); }} /></label>
      <p className="art-note">JPEG, PNG ou WebP de até 16 MB. A prévia mostra o recorte que aparecerá na biblioteca.</p>
      <div className="art-buttons">
        {draft && <button type="button" className="button dark" disabled={busy} onClick={() => save(false)}>Salvar pôster</button>}
        {current && <button type="button" className="text-action" disabled={busy} onClick={() => save(true)}>Restaurar pôster do catálogo</button>}
      </div>
      {error && <p role="alert">{error}</p>}<p role="status">{busy ? "Preparando pôster…" : message}</p>
    </div>
  </div>;
}
