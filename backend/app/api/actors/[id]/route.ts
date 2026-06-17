import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadActors() {
  const path = resolve(process.cwd(), "../data/actors.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadTactics() {
  const path = resolve(process.cwd(), "../data/tactics.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actors = loadActors();
  const actor = actors.find((a: any) => a.user_id === params.id);

  if (!actor) {
    return NextResponse.json({ error: "Actor not found" }, { status: 404, headers: CORS });
  }

  const tactics = loadTactics();
  const tacticDetails = tactics.filter((t: any) => actor.tactics.includes(t.id));

  return NextResponse.json({ ...actor, tacticDetails }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
