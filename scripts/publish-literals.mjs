// Literales de texto largos de un script de evaluate_script (backticks, comillas dobles o simples),
// para que el gate de publicación MCP verifique por sha el texto que se va a pegar, venga como venga.

export const MIN_LITERAL = 120;

export function longLiterals(code) {
  const out = [];
  const re = /`((?:\\[\s\S]|[^`\\])*)`|"((?:\\[\s\S]|[^"\\\n])*)"|'((?:\\[\s\S]|[^'\\\n])*)'/g;
  for (const m of code.matchAll(re)) {
    if (m[1] !== undefined) {
      if (/\$\{/.test(m[1])) {
        if (m[1].length >= MIN_LITERAL) out.push({ dynamic: true, text: m[1] });
        continue;
      }
      const v = m[1].replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
      if (v.length >= MIN_LITERAL) out.push({ dynamic: false, text: v });
      continue;
    }
    const raw = m[2] ?? m[3];
    let v;
    try {
      v = JSON.parse('"' + raw.replace(/\\'/g, "'").replace(/(^|[^\\])"/g, '$1\\"') + '"');
    } catch {
      v = raw;
    }
    if (v.length >= MIN_LITERAL) out.push({ dynamic: false, text: v });
  }
  return out;
}
