import { NextResponse } from "next/server";
import { loadTactics, loadActors, CORS } from "@/lib/data-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tactic = loadTactics().find((t) => t.id === id);

    if (!tactic) {
      return NextResponse.json({ error: "Tactic not found" }, { status: 404, headers: CORS });
    }

    const knownActors = loadActors()
      .filter((a) => tactic.actors_known.includes(a.user_id ?? ""))
      .map((a) => ({ user_id: a.user_id, name: a.name, verdict: a.verdict, tone: a.tone }));

    return NextResponse.json({ ...tactic, knownActors }, { headers: CORS });
  } catch (error) {
    console.error("GET /api/tactics/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to load tactic" },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
