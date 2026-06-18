import { NextResponse } from "next/server";
import { loadTactics, CORS, type Tactic } from "@/lib/data-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const register = searchParams.get("register");

    let tactics: Tactic[] = loadTactics();

    if (category) tactics = tactics.filter((t) => t.category === category);
    if (register) tactics = tactics.filter((t) => t.register === register || t.register === "any");

    return NextResponse.json(tactics, { headers: CORS });
  } catch (error) {
    console.error("GET /api/tactics failed:", error);
    return NextResponse.json(
      { error: "Failed to load tactics" },
      { status: 500, headers: CORS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}
