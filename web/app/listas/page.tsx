import { SiteFrame } from "../frame";
import { Lists } from "./lists";
import "./lists.css";

export const dynamic = "force-dynamic";

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ titulo?: string }> }) {
  const { titulo } = await searchParams;
  return <SiteFrame section="lists"><Lists incomingKey={typeof titulo === "string" ? titulo : ""} /></SiteFrame>;
}
