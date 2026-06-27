// paths.mjs — SSOT de resolución de paths que el USUARIO pasa por CLI.
//
// El bug que esto mata (2026-06-21): varios scripts resolvían `--master`/`--draft`/
// `--source` con `resolve(ROOT, userArg)`, hardcodeando el project root. Un path
// relativo en una CLI debe resolverse contra el CWD (donde el usuario está parado),
// no contra una raíz fija — pasar `../.coagent/x.md` desde `scripts/` apuntaba a
// `Documents/.coagent/x.md` (ENOENT) en vez de al archivo real. Inconsistente además
// con seed-gate.mjs, que sí resolvía contra el CWD.
//
// Semántica (predecible y robusta):
//   - absoluto            → tal cual.
//   - relativo y existe desde el CWD   → contra el CWD (lo que el usuario ve).
//   - relativo, no en CWD pero sí en ROOT → contra ROOT (preserva los defaults del
//                                            repo, p.ej. `.coagent/...` corriendo desde scripts/).
//   - relativo nuevo (output que aún no existe) → contra el CWD (predecible para escribir).
import { resolve, isAbsolute } from 'path';
import { existsSync } from 'fs';

export function resolveUserPath(p, root) {
  if (!p) return p;
  if (isAbsolute(p)) return p;
  const fromCwd = resolve(process.cwd(), p);
  if (existsSync(fromCwd)) return fromCwd;
  if (root) {
    const fromRoot = resolve(root, p);
    if (existsSync(fromRoot)) return fromRoot;
  }
  return fromCwd;
}
