import { NextResponse } from "next/server";
import { loadActors, loadTactics, CORS } from "@/lib/data-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = loadActors().find((a) => a.user_id === id);

    if (!actor) {
      return NextResponse.json({ error: "Actor not found" }, { status: 404, headers: CORS });
    }

    const tacticDetails = loadTactics().filter((t) => actor.tactics.includes(t.id));

    return NextResponse.json({ ...actor, tacticDetails }, { headers: CORS });
  } catch (error) {
    console.error("GET /api/actors/[id] failed:", error);
    return NextResponse.json(
      { error: "Failed to load actor" },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
