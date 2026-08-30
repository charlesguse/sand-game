import type { GeometryComponent } from './geometryInvariants';

/**
 * The gate's uniform return shape (FR-014) — every exported check below returns one of these,
 * whether it passed or failed, so a failing assertion can render a complete diagnostic without
 * re-opening the component's <style> block.
 */
export interface GeometryCheckResult {
  ok: boolean;
  component: GeometryComponent;
  invariant: string;
  assumption: string;
  found: string;
}

/** Renders a GeometryCheckResult's four diagnostic fields as one line (research.md §8, FR-014). */
export function formatFailure(result: GeometryCheckResult): string {
  return `[${result.component}] ${result.invariant}: assumed "${result.assumption}", found "${result.found}"`;
}

/**
 * Extracts the text between the first `{` following `selector` and its matching closing `}`
 * (balanced-brace aware — the components this feature reads never nest rule blocks inside a
 * selector's braces, but this stays correct even if a value ever contained a stray brace-like
 * token). Returns '' if the selector isn't found.
 */
export function extractRuleBlock(source: string, selector: string): string {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex === -1) return '';
  const braceStart = source.indexOf('{', selectorIndex);
  if (braceStart === -1) return '';

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart + 1, i);
    }
  }
  return '';
}

/**
 * Splits a CSS rule block's text into { property, value } pairs — split on `;`, then on the
 * first `:`, trim (research.md §3). The hand-written <style> blocks this feature reads never
 * nest rules or contain a `;` inside a value, so this naive splitter is exact for them.
 */
export function parseDeclarations(ruleBlockSource: string): Array<{ property: string; value: string }> {
  const declarations: Array<{ property: string; value: string }> = [];
  for (const statement of ruleBlockSource.split(';')) {
    const colonIndex = statement.indexOf(':');
    if (colonIndex === -1) continue;
    const property = statement.slice(0, colonIndex).trim();
    const value = statement.slice(colonIndex + 1).trim();
    if (property === '' || value === '') continue;
    declarations.push({ property, value });
  }
  return declarations;
}
