import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadTactics() {
  const path = resolve(process.cwd(), "../data/tactics.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const register = searchParams.get("register");

  let tactics = loadTactics();

  if (category) tactics = tactics.filter((t: any) => t.category === category);
  if (register) tactics = tactics.filter((t: any) => t.register === register || t.register === "any");

  return NextResponse.json(tactics, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
