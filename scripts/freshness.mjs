// Tope de frescura del pipeline (SSOT, sin dependencias — db.mjs y fb-lib.mjs lo importan).
//
// El pipeline NUNCA abre ni emite por sí solo un hilo, una notificación o una
// interacción más vieja que MAX_AGE_DAYS. Un debate de hace semanas ya no tiene lurker
// vivo: reabrirlo quema Chrome, tokens y la atención de Bernard (2026-09-19: el sweep
// iba a reabrir hilos de junio y el scan listó notifs de 5 semanas).
//
// Override: `--max-age-days N` en argv o VEGAN_MAX_AGE_DAYS=N. HARD_CEILING_DAYS es el
// techo absoluto: el hook `.claude/hooks/pipeline-freshness-cap.mjs` deniega cualquier
// invocación que pida más, y este módulo lo recorta igual por si el hook no corre.

export const DEFAULT_MAX_AGE_DAYS = 7;
export const HARD_CEILING_DAYS = 14;
export const UNKNOWN_AGE = 9e9;

function clamp(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_MAX_AGE_DAYS;
  return Math.min(v, HARD_CEILING_DAYS);
}

export function resolveMaxAgeDays(argv = process.argv, env = process.env) {
  const i = argv.indexOf('--max-age-days');
  if (i >= 0 && argv[i + 1]) return clamp(argv[i + 1]);
  const eq = argv.find((a) => a.startsWith('--max-age-days='));
  if (eq) return clamp(eq.split('=')[1]);
  if (env.VEGAN_MAX_AGE_DAYS) return clamp(env.VEGAN_MAX_AGE_DAYS);
  return DEFAULT_MAX_AGE_DAYS;
}

export const MAX_AGE_DAYS = resolveMaxAgeDays();
export const MAX_AGE_MIN = MAX_AGE_DAYS * 1440;

// Minutos (de ageMinutes) → ¿fuera del tope? La edad desconocida NO es vieja: es
// "sin fechar", candidata a confirmar (Art. 2), y se compara por identidad.
export function isStaleMinutes(min, maxAgeDays = MAX_AGE_DAYS) {
  if (min === UNKNOWN_AGE) return false;
  return min > maxAgeDays * 1440;
}

export function ageDaysFromDate(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / 86400000;
}

// Fecha ISO (YYYY-MM-DD de las interacciones del moat) → ¿fuera del tope?
// Sin fecha parseable → no se declara vieja (misma honestidad que UNKNOWN_AGE).
export function isStaleDate(iso, maxAgeDays = MAX_AGE_DAYS, now = Date.now()) {
  const d = ageDaysFromDate(iso, now);
  return d !== null && d > maxAgeDays;
}
