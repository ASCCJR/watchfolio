"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ListOrdered, Trash2 } from "lucide-react";
import type { Title } from "../../lib/titles";
import { Feedback, kindNames, Poster } from "../collection";
import type { ShelfEntry } from "../../db/shelf-types";
import { request, RequestError, useResource } from "../use-resource";

type PersonalList = { id: string; name: string; titles: Title[]; revision: number };
const detailUrl = (key: string) => "/?titulo=" + encodeURIComponent(key);

export function Lists({ incomingKey }: { incomingKey: string }) {
  const resource = useResource<{ lists: PersonalList[] }>("/api/lists", true);
  const shelf = useResource<{ entries: ShelfEntry[] }>("/api/shelf", true);
  const incoming = useResource<{ title: Title }>(incomingKey ? "/api/titles/" + encodeURIComponent(incomingKey) : null);
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState(false);
  const [choice, setChoice] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const newId = useRef("");
  const lists = resource.data?.lists ?? [];
  const list = lists.find(item => item.id === selected) ?? lists[0];
  const candidates = new Map<string, Title>();
  if (incoming.data?.title) candidates.set(incoming.data.title.key, incoming.data.title);
  for (const entry of shelf.data?.entries ?? []) if (entry.status) candidates.set(entry.title.key, entry.title);
  const options = Array.from(candidates.values()).filter(title => !list?.titles.some(item => item.key === title.key));
  const addKey = options.some(title => title.key === choice) ? choice : options[0]?.key;

  async function change(action: () => Promise<void>, message: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      await resource.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a lista.");
      if (reason instanceof RequestError && [401, 403, 409].includes(reason.status)) await resource.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    // Reuse the identifier if the first response was lost after the insert.
    const id = newId.current ||= crypto.randomUUID();
    void change(async () => {
      await request("/api/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: newName.trim() }) });
      setSelected(id); setNewName(""); setRename(false); newId.current = "";
    }, "Lista criada.");
  }

  function edit(data: Record<string, string>, message: string) {
    if (!list) return;
    void change(async () => {
      await request("/api/lists/" + list.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, revision: list.revision }) });
      setRename(false);
    }, message);
  }

  return <div className="lists-page">
    <header className="lists-intro"><ListOrdered aria-hidden="true" /><h1>Minhas listas</h1><p>Organize filmes, séries e animes na ordem que quiser.</p></header>
    {resource.error && <Feedback error={resource.error} retry={resource.refresh} />}
    {!resource.data && !resource.error && <p role="status">Carregando listas…</p>}
    {error && <p role="alert" className="notice">{error}</p>}
    <p className="list-feedback" role="status">{notice}</p>
    {resource.data && <div className="lists-layout">
      <aside className="lists-menu">
        <form className="list-form" onSubmit={create}><label htmlFor="list-name">Criar lista</label>
          <input id="list-name" required maxLength={100} value={newName} placeholder="Nome da lista" onChange={e => { setNewName(e.target.value); newId.current = ""; }} />
          <button className="button dark" disabled={busy || !newName.trim()}>Criar</button>
        </form>
        {lists.length > 0 && <ul aria-label="Escolher lista">{lists.map(item => <li key={item.id}>
          <button type="button" aria-pressed={item.id === list?.id} disabled={busy} onClick={() => { setSelected(item.id); setRename(false); setNotice(""); setError(""); }}>{item.name}<span>{item.titles.length}</span></button>
        </li>)}</ul>}
      </aside>
      {list ? <section className="list-content" key={list.id}>
        <div className="list-title"><h2>{list.name}</h2><button type="button" className="text-action" disabled={busy} onClick={() => setRename(!rename)}>{rename ? "Cancelar" : "Renomear"}</button></div>
        {rename && <form className="list-form" onSubmit={event => { event.preventDefault(); edit({ action: "rename", name: String(new FormData(event.currentTarget).get("name") ?? "").trim() }, "Nome atualizado."); }}>
          <label htmlFor="rename-list">Novo nome</label><input id="rename-list" name="name" defaultValue={list.name} maxLength={100} required />
          <button className="button dark" disabled={busy}>Salvar nome</button>
        </form>}
        {list.titles.length ? <ol className="list-items">{list.titles.map((title, index) => <li key={title.key}>
          <a href={detailUrl(title.key)}><Poster title={title} /><span>{title.name}<small>{[kindNames[title.kind], title.year].filter(Boolean).join(" · ")}</small></span></a>
          <div className="list-controls">
            <button type="button" aria-label={"Subir " + title.name} disabled={busy || index === 0} onClick={() => edit({ action: "up", key: title.key }, "Ordem atualizada.")}><ArrowUp /></button>
            <button type="button" aria-label={"Descer " + title.name} disabled={busy || index === list.titles.length - 1} onClick={() => edit({ action: "down", key: title.key }, "Ordem atualizada.")}><ArrowDown /></button>
            <button type="button" aria-label={"Retirar " + title.name + " da lista"} disabled={busy} onClick={() => edit({ action: "remove", key: title.key }, "Título retirado da lista.")}><Trash2 /></button>
          </div>
        </li>)}</ol> : <p>Esta lista ainda está vazia.</p>}
        {incoming.error && <Feedback error={incoming.error} retry={incoming.refresh} />}
        {shelf.error && <Feedback error={shelf.error} retry={shelf.refresh} />}
        {incomingKey && list.titles.some(item => item.key === incomingKey) && <p>O título selecionado já está nesta lista.</p>}
        {addKey && <form className="list-form" onSubmit={event => { event.preventDefault(); edit({ action: "add", key: addKey }, "Título adicionado à lista."); }}>
          <label htmlFor="list-title-choice">Adicionar título</label>
          <select id="list-title-choice" value={addKey} onChange={event => setChoice(event.target.value)}>{options.map(title => <option key={title.key} value={title.key}>{title.name} · {kindNames[title.kind]} {title.year}</option>)}</select>
          <button className="button dark" disabled={busy}>Adicionar</button>
        </form>}
        <a className="text-action" href="/?buscar=1">Buscar outros títulos no catálogo</a>
        <button className="delete-list" type="button" disabled={busy} onClick={() => {
          if (window.confirm("Excluir a lista “" + list.name + "”? Os títulos e o histórico da biblioteca serão preservados.")) {
            void change(async () => { await request("/api/lists/" + list.id + "?revision=" + list.revision, { method: "DELETE" }); setSelected(""); }, "Lista excluída.");
          }
        }}>Excluir lista</button>
      </section> : <section className="list-content"><h2>Crie sua primeira lista</h2>
        <p>{incoming.data ? "Depois de criar a lista, adicione " + incoming.data.title.name + "." : "Escolha um nome para começar a reunir títulos."}</p></section>}
    </div>}
  </div>;
}
