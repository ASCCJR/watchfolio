"use client";

import { useEffect, useRef, useState } from "react";
import type { Title } from "@/lib/titles";
import { artworkPath, emptyMeme, palettes, type MemeDetail, type MemeRecipe, type Palette, type SavedMeme } from "@/lib/artwork";
import { request, useResource } from "../use-resource";
import { pngBlob, preparePhoto, renderMeme } from "./drawing";

export function MemeEditor({ title }: { title: Title }) {
  const base = artworkPath(title.key) + "/memes";
  const gallery = useResource<{ memes: SavedMeme[] }>(base, true);
  const [recipe, setRecipe] = useState<MemeRecipe>({ ...emptyMeme });
  const [selected, setSelected] = useState<{ id: string; revision: string | null }>(() => ({ id: crypto.randomUUID(), revision: null }));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null), [renderError, setRenderError] = useState("");
  const [rendered, setRendered] = useState<{ recipe: MemeRecipe; url: string } | null>(null);
  const preview = useRef<HTMLCanvasElement>(null), photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true, url: string | null = null;
    setRenderError("");
    renderMeme(recipe).then(async image => {
      const ctx = preview.current?.getContext("2d");
      if (!active || !ctx) return;
      ctx.drawImage(image, 0, 0);
      if (!recipe.caption.trim()) return;
      const blob = await pngBlob(image);
      if (!active) return;
      url = URL.createObjectURL(blob);
      setRendered({ recipe, url });
    }).catch(reason => { if (active) setRenderError(reason instanceof Error ? reason.message : "Falha ao gerar a prévia."); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [recipe]);

  function newDraft() {
    setSelected({ id: crypto.randomUUID(), revision: null }); setRecipe({ ...emptyMeme }); setDeleteId(null);
  }
  function change(patch: Partial<MemeRecipe>) {
    setRecipe(current => ({ ...current, ...patch })); setMessage(""); setError("");
  }
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await work(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao concluir a ação."); }
    finally { setBusy(false); }
  }
  function edit(id: string) {
    return action(async () => {
      const item = await request<MemeDetail>(base + "/" + id);
      setRecipe(item.recipe); setSelected({ id, revision: item.revision }); setDeleteId(null); setMessage("Meme aberto no editor.");
    });
  }
  function save() {
    return action(async () => {
      const { revision } = await request<{ revision: string }>(base + "/" + selected.id, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: selected.revision, recipe }),
      });
      setSelected({ id: selected.id, revision }); await gallery.refresh(); setMessage("Meme salvo na sua coleção.");
    });
  }
  function remove(item: SavedMeme) {
    return action(async () => {
      await request(base + "/" + item.id + "?revision=" + item.revision, { method: "DELETE" });
      if (selected.id === item.id) newDraft();
      setDeleteId(null); await gallery.refresh(); setMessage("Meme excluído.");
    });
  }
  const png = rendered?.recipe === recipe ? rendered.url : null;
  const filename = title.name.replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 75) + "-meme.png";
  return <div className="art-editor meme-editor">
    <div className="meme-workspace">
      <div className="art-form">
        <h3>{selected.revision ? "Editar meme" : "Criar meme"}</h3>
        <label>Legenda<textarea maxLength={120} rows={3} value={recipe.caption} disabled={busy} onChange={event => change({ caption: event.target.value })} /></label>
        {!recipe.photo && <label>Fundo<select value={recipe.palette} disabled={busy} onChange={event => change({ palette: event.target.value as Palette })}>
          {Object.entries(palettes).map(([key, theme]) => <option key={key} value={key}>{theme.name}</option>)}</select></label>}
        <label>Usar minha imagem<input type="file" accept="image/jpeg,image/png,image/webp" ref={photoInput} disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          if (file) void action(async () => { try { change({ photo: await preparePhoto(file, false) }); } finally { if (photoInput.current) photoInput.current.value = ""; } });
        }} /></label>
        {recipe.photo && <button type="button" className="text-action" disabled={busy} onClick={() => change({ photo: null })}>Usar fundo do editor</button>}
      </div>
      <figure><canvas ref={preview} width={800} height={600} role="img" aria-label={recipe.caption || "Prévia do fundo do meme"} />
        <figcaption>{png ? <a href={png} target="_blank" rel="noopener">Abrir PNG em outra aba</a> : "Prévia do PNG"}</figcaption></figure>
    </div>
    <div className="art-buttons">
      <button type="button" className="button dark" disabled={busy || !png} onClick={save}>{selected.revision ? "Salvar alterações" : "Salvar meme"}</button>
      {png && <a className="button plain" href={png} download={filename}>Baixar PNG</a>}
      {selected.revision && <button type="button" className="text-action" disabled={busy} onClick={() => { newDraft(); setMessage(""); setError(""); }}>Criar outro meme</button>}
    </div>
    {(error || renderError) && <p role="alert">{error || renderError}</p>}
    <p role="status">{busy ? "Processando…" : message}</p>
    <section className="meme-gallery"><h3>Memes salvos</h3>
      {gallery.error ? <div role="alert">{gallery.error.message} <button type="button" className="text-action" onClick={gallery.refresh}>Tentar novamente</button></div>
        : !gallery.data ? <p>Carregando memes…</p>
        : !gallery.data.memes.length ? <p>Você ainda não salvou memes deste título.</p>
        : <ul>{gallery.data.memes.map(item => <li key={item.id}><span>{item.caption}</span><div className="art-buttons">
          {deleteId === item.id ? <>
            <button type="button" className="text-action" disabled={busy} onClick={() => remove(item)}>Confirmar exclusão</button>
            <button type="button" className="text-action" onClick={() => setDeleteId(null)}>Cancelar</button>
          </> : <>
            <button type="button" className="text-action" disabled={busy} aria-label={"Abrir meme: " + item.caption} onClick={() => edit(item.id)}>Abrir</button>
            <button type="button" className="text-action" disabled={busy} aria-label={"Excluir meme: " + item.caption} onClick={() => setDeleteId(item.id)}>Excluir</button>
          </>}
        </div></li>)}</ul>}
    </section>
  </div>;
}
