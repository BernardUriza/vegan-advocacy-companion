import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadActors() {
  const path = resolve(process.cwd(), "../data/actors.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bando = searchParams.get("bando");
  const tactic = searchParams.get("tactic");
  const verdict = searchParams.get("verdict");

  let actors = loadActors();

  if (bando) actors = actors.filter((a: any) => a.bando === bando);
  if (tactic) actors = actors.filter((a: any) => a.tactics.includes(tactic));
  if (verdict) actors = actors.filter((a: any) => a.verdict === verdict);

  return NextResponse.json(actors, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
