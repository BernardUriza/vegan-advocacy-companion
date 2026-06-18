import { NextResponse } from "next/server";
import { loadActors, CORS, type Actor } from "@/lib/data-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bando = searchParams.get("bando");
    const tactic = searchParams.get("tactic");
    const verdict = searchParams.get("verdict");

    let actors: Actor[] = loadActors();

    if (bando) actors = actors.filter((a) => a.bando === bando);
    if (tactic) actors = actors.filter((a) => a.tactics.includes(tactic));
    if (verdict) actors = actors.filter((a) => a.verdict === verdict);

    return NextResponse.json(actors, { headers: CORS });
  } catch (error) {
    console.error("GET /api/actors failed:", error);
    return NextResponse.json(
      { error: "Failed to load actors" },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
