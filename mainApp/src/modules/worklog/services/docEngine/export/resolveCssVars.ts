const ROOT_VAR_REGEX = /:root\s*\{([^}]+)\}/;
const VAR_DECL_REGEX = /--([\w-]+)\s*:\s*([^;]+);/g;
const VAR_USE_REGEX = /var\(\s*--([\w-]+)(?:\s*,\s*([^)]+))?\)/g;

export function resolveCssVars(html: string): string {
  const rootMatch = html.match(ROOT_VAR_REGEX);
  if (!rootMatch) return html;

  const vars = new Map<string, string>();
  let decl: RegExpExecArray | null;
  while ((decl = VAR_DECL_REGEX.exec(rootMatch[1])) !== null) {
    vars.set(decl[1], decl[2].trim());
  }

  let result = html;
  for (let i = 0; i < 5; i++) {
    const next = result.replace(VAR_USE_REGEX, (full, name, fallback) => {
      return vars.get(name) || (fallback ? fallback.trim() : full);
    });
    if (next === result) break;
    result = next;
  }

  return result;
}
