// Parser de argumentos compartido por comment-prepare.mjs y el hook de procedencia: si los dos
// leen el mismo argv de la misma forma, no hay invocación que el hook valide y el script lea distinto.

export const PREPARE_FLAGS = new Set(['--url', '--author', '--anchor', '--body-file', '--image', '--mode']);
export const PREPARE_MODES = new Set(['reply', 'root']);

export function parseArgs(argv, allowed = PREPARE_FLAGS) {
  const flags = {};
  const positionals = [];
  const unknown = [];
  const repeated = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positionals.push(a); continue; }
    const eq = a.indexOf('=');
    const name = eq >= 0 ? a.slice(0, eq) : a;
    const value = eq >= 0 ? a.slice(eq + 1) : argv[++i];
    if (!allowed.has(name)) { unknown.push(name); continue; }
    if (name in flags) repeated.push(name);
    flags[name] = value ?? null;
  }
  return { flags, positionals, unknown, repeated };
}

export function shellTokens(s) {
  const out = [];
  let cur = '';
  let q = null;
  let has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < s.length) cur += s[++i];
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < s.length) { cur += s[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (has || cur) out.push(cur); cur = ''; has = false; continue; }
    if (';&|<>`$(){}*?'.includes(c)) { if (has || cur) out.push(cur); out.push({ op: c }); cur = ''; has = false; continue; }
    cur += c;
    has = true;
  }
  if (q) return null;
  if (has || cur) out.push(cur);
  return out;
}
