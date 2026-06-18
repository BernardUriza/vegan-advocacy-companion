import { readFileSync } from "fs";
import { resolve } from "path";

export interface Interaction {
  thread_id: string;
  date: string;
  their_move: string;
  our_reply_summary: string;
  outcome: string;
}

export interface Actor {
  user_id: string | null;
  name: string;
  profile_url: string | null;
  bando: string;
  postura_nucleo: string;
  analisis: string;
  tactics: string[];
  tone: string;
  verdict: string;
  register: string;
  what_not_to_do: string;
  threads: string[];
  interactions: Interaction[];
}

export interface Tactic {
  id: string;
  name: string;
  category: string;
  definition: string;
  canonical_counter: string;
  register: string;
  what_not_to_do: string;
  actors_known: string[];
  fallacy_type_id: string | null;
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

// data/ lives at the repo root, one level above the Next.js app (backend/).
// next.config.ts traces these into the serverless bundle via outputFileTracingIncludes.
// Resolve candidates so it works both in dev (cwd=backend) and in a traced bundle.
function resolveDataPath(file: string): string {
  const candidates = [
    resolve(process.cwd(), "..", "data", file), // dev: cwd = backend/
    resolve(process.cwd(), "data", file), // traced bundle / cwd = repo root
  ];
  for (const c of candidates) {
    try {
      readFileSync(c);
      return c;
    } catch {
      // try next candidate
    }
  }
  // Surface the primary expected path in the thrown error for operators.
  return candidates[0];
}

let actorsCache: Actor[] | null = null;
let tacticsCache: Tactic[] | null = null;

export function loadActors(): Actor[] {
  if (actorsCache) return actorsCache;
  actorsCache = JSON.parse(readFileSync(resolveDataPath("actors.json"), "utf8"));
  return actorsCache!;
}

export function loadTactics(): Tactic[] {
  if (tacticsCache) return tacticsCache;
  tacticsCache = JSON.parse(readFileSync(resolveDataPath("tactics.json"), "utf8"));
  return tacticsCache!;
}
