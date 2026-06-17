import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadTactics() {
  const path = resolve(process.cwd(), "../data/tactics.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadActors() {
  const path = resolve(process.cwd(), "../data/actors.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const tactics = loadTactics();
  const tactic = tactics.find((t: any) => t.id === params.id);

  if (!tactic) {
    return NextResponse.json({ error: "Tactic not found" }, { status: 404, headers: CORS });
  }

  const actors = loadActors();
  const knownActors = actors.filter((a: any) => tactic.actors_known.includes(a.user_id))
    .map((a: any) => ({ user_id: a.user_id, name: a.name, verdict: a.verdict, tone: a.tone }));

  return NextResponse.json({ ...tactic, knownActors }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
