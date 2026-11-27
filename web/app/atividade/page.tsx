import { SiteFrame } from "../frame";
import { ActivityView } from "./activity-view";
import "./activity.css";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  return <SiteFrame section="activity"><ActivityView initialYear={typeof ano === "string" && /^\d{4}$/.test(ano) ? ano : ""} /></SiteFrame>;
}
