import type { NextConfig } from "next";
import { join } from "path";

const nextConfig: NextConfig = {
  // data/ lives at the repo root (one level above backend/). By default Next's
  // file tracing root is the nearest lockfile (backend/), which would exclude
  // ../data and 500 every /api/actors|tactics call in a deployed bundle.
  // Point the tracing root at the repo root and explicitly include the JSON
  // SSOT so it ships inside the serverless function bundle.
  outputFileTracingRoot: join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/api/actors": ["../data/**"],
    "/api/actors/[id]": ["../data/**"],
    "/api/tactics": ["../data/**"],
    "/api/tactics/[id]": ["../data/**"],
  },
};

export default nextConfig;
