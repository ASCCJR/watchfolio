import { catalogErrorResponse } from "@/lib/catalog";
import { browseTitles } from "@/lib/titles";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const raw = params.get("page") ?? "0";
    return Response.json(await browseTitles(params.get("type") ?? "all", /^\d+$/.test(raw) ? Number(raw) : NaN));
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
