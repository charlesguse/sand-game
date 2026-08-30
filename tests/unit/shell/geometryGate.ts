import { GEOMETRY_INVARIANTS, CONTROL_ALLOWED_DECLARATIONS, CONTROL_SELECTED_ALLOWED_DECLARATIONS } from './geometryInvariants';
import type { GeometryComponent, GeometryCategory } from './geometryInvariants';

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
  const withoutComments = ruleBlockSource.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations: Array<{ property: string; value: string }> = [];
  for (const statement of withoutComments.split(';')) {
    const colonIndex = statement.indexOf(':');
    if (colonIndex === -1) continue;
    const property = statement.slice(0, colonIndex).trim();
    const value = statement.slice(colonIndex + 1).trim();
    if (property === '' || value === '') continue;
    declarations.push({ property, value });
  }
  return declarations;
}

/** Looks up a GEOMETRY_INVARIANTS entry's assumption text by id — the single source every check below quotes from, so a check's failure message can never drift from the documented list. */
function assumptionFor(id: string): string {
  const entry = GEOMETRY_INVARIANTS.find((invariant) => invariant.id === id);
  if (entry === undefined) throw new Error(`geometryGate: no GEOMETRY_INVARIANTS entry for id "${id}"`);
  return entry.assumption;
}

function invariantIdFor(component: GeometryComponent, checkId: string, category: GeometryCategory): string | undefined {
  return GEOMETRY_INVARIANTS.find(
    (invariant) => invariant.component === component && invariant.checkId === checkId && invariant.category === category,
  )?.id;
}

// --- toolbar-control -------------------------------------------------------

const CONTROL_RULE_SELECTOR = '.control {';
const CONTROL_SELECTED_RULE_SELECTOR = '.control.selected {';

export function checkControlBoxSizing(toolbarSource: string): GeometryCheckResult {
  const invariant = 'toolbar-control-box-sizing';
  const declarations = parseDeclarations(extractRuleBlock(toolbarSource, CONTROL_RULE_SELECTOR));
  const boxSizing = declarations.find((d) => d.property === 'box-sizing');
  const ok = boxSizing?.value === 'border-box';
  return {
    ok,
    component: 'toolbar-control',
    invariant,
    assumption: assumptionFor(invariant),
    found: boxSizing ? `box-sizing: ${boxSizing.value}` : 'absent',
  };
}

function categorizeGuardedProperty(property: string): GeometryCategory | undefined {
  if (/^border(-\w+)?$/.test(property)) return 'borders';
  if (/^padding(-\w+)?$/.test(property)) return 'padding';
  if (/^margin(-\w+)?$/.test(property)) return 'margins';
  if (['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'].includes(property)) return 'sizing';
  if (property === 'transform') return 'transforms';
  return undefined;
}

/** Extracts every scale()/scaleX()/scaleY()/scale3d()/matrix() factor's magnitude from a transform value (research.md §4); translate() and rotate() are size-neutral and ignored. */
function transformGrowthFactors(value: string): number[] {
  const factors: number[] = [];
  const push = (raw: string) => {
    const n = parseFloat(raw.trim());
    if (!Number.isNaN(n)) factors.push(Math.abs(n));
  };

  for (const m of value.matchAll(/scale(?:X|Y)?\(([^)]+)\)/g)) {
    for (const part of m[1].split(',')) push(part);
  }
  for (const m of value.matchAll(/scale3d\(([^)]+)\)/g)) {
    for (const part of m[1].split(',')) push(part);
  }
  for (const m of value.matchAll(/matrix\(([^)]+)\)/g)) {
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length >= 4) {
      factors.push(Math.abs(parts[0]), Math.abs(parts[3]));
    }
  }
  return factors;
}

/**
 * Closed-allowlist scan (FR-018, FR-018a) over a guarded rule block: every declaration whose
 * property matches GUARDED_PROPERTY_PATTERN, other than box-sizing (covered separately by
 * checkControlBoxSizing), must either be a transform whose scale factors never exceed 1
 * (research.md §4) or must match `allowedDeclarations`'s value for that property exactly —
 * unrecognized or drifted, either fails.
 */
function scanGuardedDeclarations(
  ruleBlockSource: string,
  component: GeometryComponent,
  checkId: string,
  allowedDeclarations: Record<string, string | RegExp>,
): GeometryCheckResult[] {
  const results: GeometryCheckResult[] = [];
  for (const { property, value } of parseDeclarations(ruleBlockSource)) {
    if (property === 'box-sizing') continue;

    const guardedMatch = /^(box-sizing|border(-\w+)?|padding(-\w+)?|margin(-\w+)?|width|height|min-width|min-height|max-width|max-height|transform)$/.test(
      property,
    );
    if (!guardedMatch) continue;

    const category = categorizeGuardedProperty(property);
    const invariantId = category ? invariantIdFor(component, checkId, category) : undefined;
    const assumption =
      invariantId !== undefined
        ? assumptionFor(invariantId)
        : `every declaration inside the guarded set (box-sizing, border*, padding*, margin*, width/height incl. min/max, transform) must be named by the invariant list or explicitly recorded as inert (FR-018a).`;
    const invariant = invariantId ?? `${component}-unrecognized-guarded-declaration`;

    if (property === 'transform') {
      const factors = transformGrowthFactors(value);
      const growing = factors.filter((f) => f > 1);
      results.push({
        ok: growing.length === 0,
        component,
        invariant,
        assumption,
        found: `transform: ${value}`,
      });
      continue;
    }

    const allowed = allowedDeclarations[property];
    if (allowed === undefined) {
      results.push({ ok: false, component, invariant, assumption, found: `${property}: ${value} (unrecognized in guarded set)` });
      continue;
    }
    const matches = allowed instanceof RegExp ? allowed.test(value) : allowed === value;
    results.push({
      ok: matches,
      component,
      invariant,
      assumption,
      found: matches ? `${property}: ${value}` : `${property}: ${value} (expected ${allowed})`,
    });
  }
  return results;
}

export function checkControlGuardedDeclarations(toolbarSource: string): GeometryCheckResult[] {
  return scanGuardedDeclarations(
    extractRuleBlock(toolbarSource, CONTROL_RULE_SELECTOR),
    'toolbar-control',
    'checkControlGuardedDeclarations',
    CONTROL_ALLOWED_DECLARATIONS,
  );
}

export function checkSelectedGuardedDeclarations(toolbarSource: string): GeometryCheckResult[] {
  return scanGuardedDeclarations(
    extractRuleBlock(toolbarSource, CONTROL_SELECTED_RULE_SELECTOR),
    'toolbar-control',
    'checkSelectedGuardedDeclarations',
    CONTROL_SELECTED_ALLOWED_DECLARATIONS,
  );
}

// --- toolbar-band ------------------------------------------------------------

const BAND_RULE_SELECTOR = '.toolbar {';
const BAND_RAIL_RULE_SELECTOR = '.toolbar.rail {';

export function checkRailFlowDirection(toolbarSource: string): GeometryCheckResult {
  const invariant = 'toolbar-band-flow-direction';
  const baseFlowDirection = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RULE_SELECTOR)).find(
    (d) => d.property === 'flex-direction',
  );
  const railFlowDirection = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RAIL_RULE_SELECTOR)).find(
    (d) => d.property === 'flex-direction',
  );
  // The template must apply .rail from the computed arrangement, not a re-derived media query
  // (FR-024 — carries forward spec 012's toolbarGeometry.test.ts assertion of the same fact).
  const appliesRailFromArrangement = /class:rail=\{layout\.arrangement === 'rail'\}/.test(toolbarSource);
  const ok = baseFlowDirection === undefined && railFlowDirection?.value === 'column' && appliesRailFromArrangement;
  return {
    ok,
    component: 'toolbar-band',
    invariant,
    assumption: assumptionFor(invariant),
    found: `rows: flex-direction ${baseFlowDirection ? baseFlowDirection.value : '(default, none declared)'}; rail: flex-direction ${
      railFlowDirection ? railFlowDirection.value : '(absent)'
    }; template applies .rail from layout.arrangement: ${appliesRailFromArrangement}`,
  };
}

export function checkBandWrapping(toolbarSource: string): GeometryCheckResult {
  const invariant = 'toolbar-band-wrapping';
  const flexWrap = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RULE_SELECTOR)).find((d) => d.property === 'flex-wrap');
  const ok = flexWrap?.value === 'wrap';
  return {
    ok,
    component: 'toolbar-band',
    invariant,
    assumption: assumptionFor(invariant),
    found: flexWrap ? `flex-wrap: ${flexWrap.value}` : 'absent',
  };
}

export function checkBandBoxSizing(toolbarSource: string): GeometryCheckResult {
  const invariant = 'toolbar-band-box-sizing';
  const boxSizing = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RULE_SELECTOR)).find((d) => d.property === 'box-sizing');
  const ok = boxSizing?.value === 'border-box';
  return {
    ok,
    component: 'toolbar-band',
    invariant,
    assumption: assumptionFor(invariant),
    found: boxSizing ? `box-sizing: ${boxSizing.value}` : 'absent',
  };
}

export function checkBandSafeAreaPadding(toolbarSource: string): GeometryCheckResult[] {
  const invariant = 'toolbar-band-padding';
  const assumption = assumptionFor(invariant);
  const baseDecls = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RULE_SELECTOR));
  const railDecls = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RAIL_RULE_SELECTOR));
  const results: GeometryCheckResult[] = [];

  const baseHasPadding = baseDecls.some((d) => /^padding(-\w+)?$/.test(d.property));
  results.push({
    ok: !baseHasPadding,
    component: 'toolbar-band',
    invariant,
    assumption,
    found: baseHasPadding ? 'the rows arrangement declares a padding' : 'no padding declared',
  });

  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const property = `padding-${side}`;
    const declaration = railDecls.find((d) => d.property === property);
    const expected = `env(safe-area-inset-${side})`;
    const ok = declaration?.value === expected;
    results.push({
      ok,
      component: 'toolbar-band',
      invariant,
      assumption,
      found: declaration ? `${property}: ${declaration.value}` : `${property}: absent`,
    });
  }

  return results;
}

/**
 * The one check that reads two components' source at once (research.md §7) — confirms
 * App.svelte and Toolbar.svelte both import readArrangement (and App.svelte RAIL_MEDIA_QUERY)
 * from layout.ts, and that neither <style> block still carries the old, independently
 * -thresholded @media rule.
 */
export function checkArrangementSingleSource(appSource: string, toolbarSource: string): GeometryCheckResult {
  const invariant = 'toolbar-band-arrangement-single-source';

  function importedNames(source: string, modulePathPattern: string): string[] {
    const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${modulePathPattern}['"]`, 'g');
    const names: string[] = [];
    for (const m of source.matchAll(re)) {
      for (const part of m[1].split(',')) {
        const name = part.trim();
        if (name) names.push(name);
      }
    }
    return names;
  }

  function hasOldMediaRule(source: string): boolean {
    const styleMatch = source.match(/<style[^>]*>([\s\S]*)<\/style>/);
    const styleText = styleMatch ? styleMatch[1] : '';
    return /@media[^{]*(orientation|max-height)/.test(styleText);
  }

  const appImports = importedNames(appSource, '\\./lib/layout');
  const toolbarImports = importedNames(toolbarSource, '\\./layout');
  const appOk = appImports.includes('readArrangement') && appImports.includes('RAIL_MEDIA_QUERY');
  const toolbarOk = toolbarImports.includes('readArrangement');
  const appMediaOk = !hasOldMediaRule(appSource);
  const toolbarMediaOk = !hasOldMediaRule(toolbarSource);
  const ok = appOk && toolbarOk && appMediaOk && toolbarMediaOk;

  const problems: string[] = [];
  if (!appOk) problems.push(`App.svelte imports [${appImports.join(', ')}] from './lib/layout'`);
  if (!toolbarOk) problems.push(`Toolbar.svelte imports [${toolbarImports.join(', ')}] from './layout'`);
  if (!appMediaOk) problems.push('App.svelte <style> still has an orientation/max-height @media rule');
  if (!toolbarMediaOk) problems.push('Toolbar.svelte <style> still has an orientation/max-height @media rule');

  return {
    ok,
    component: 'toolbar-band',
    invariant,
    assumption: assumptionFor(invariant),
    found: ok ? 'single source confirmed' : problems.join('; '),
  };
}

// --- Historical-cause mutators (FR-013) -------------------------------------

/**
 * Replaces the first occurrence of `search` inside the rule block matched by `selector` with
 * `replacement`, leaving the rest of `source` untouched. Returns `source` unchanged if either
 * the selector or the search text isn't found — the signal a mutator uses to detect it has been
 * silently defeated by a refactor (Edge Case, Story 2 Scenario 8).
 */
function replaceInRuleBlock(source: string, selector: string, search: string, replacement: string): string {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex === -1) return source;
  const braceStart = source.indexOf('{', selectorIndex);
  if (braceStart === -1) return source;

  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  if (braceEnd === -1) return source;

  const block = source.slice(braceStart + 1, braceEnd);
  const searchIndex = block.indexOf(search);
  if (searchIndex === -1) return source;

  const mutatedBlock = block.slice(0, searchIndex) + replacement + block.slice(searchIndex + search.length);
  return source.slice(0, braceStart + 1) + mutatedBlock + source.slice(braceEnd);
}

/** Inserts `declaration` as the first declaration inside the rule block matched by `selector`. Returns `source` unchanged if the selector isn't found (same defeated-mutator signal as replaceInRuleBlock). */
function insertIntoRuleBlock(source: string, selector: string, declaration: string): string {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex === -1) return source;
  const braceStart = source.indexOf('{', selectorIndex);
  if (braceStart === -1) return source;
  return source.slice(0, braceStart + 1) + declaration + source.slice(braceStart + 1);
}

export interface Mutator {
  id: 'content-box-control' | 'rail-row-flow' | 'selected-scale-up';
  mutate: (source: string) => string;
  targetCheckId: string;
}

/** One mutator per historical cause (FR-013) — each reintroduces a shipped bug into a copy of the live component source, derived from that source at test time rather than a fixture. */
export const HISTORICAL_CAUSE_MUTATORS: readonly Mutator[] = [
  {
    id: 'content-box-control',
    mutate: (source) => replaceInRuleBlock(source, CONTROL_RULE_SELECTOR, 'box-sizing: border-box', 'box-sizing: content-box'),
    targetCheckId: 'checkControlBoxSizing',
  },
  {
    id: 'rail-row-flow',
    mutate: (source) => replaceInRuleBlock(source, BAND_RAIL_RULE_SELECTOR, 'flex-direction: column', 'flex-direction: row'),
    targetCheckId: 'checkRailFlowDirection',
  },
  {
    id: 'selected-scale-up',
    mutate: (source) => insertIntoRuleBlock(source, CONTROL_SELECTED_RULE_SELECTOR, '\n    transform: scale(1.15);'),
    targetCheckId: 'checkSelectedGuardedDeclarations',
  },
];

/** Gaps for both arrangements (FR-009's gaps category) — flow-axis-only spacing, per research.md §6's toolbarThickness comment. */
export function checkGapAxes(toolbarSource: string): GeometryCheckResult[] {
  const invariant = 'toolbar-band-gaps';
  const assumption = assumptionFor(invariant);
  const baseDecls = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RULE_SELECTOR));
  const railDecls = parseDeclarations(extractRuleBlock(toolbarSource, BAND_RAIL_RULE_SELECTOR));

  const baseRowGap = baseDecls.find((d) => d.property === 'row-gap');
  const baseColumnGap = baseDecls.find((d) => d.property === 'column-gap');
  const railRowGap = railDecls.find((d) => d.property === 'row-gap');
  const railColumnGap = railDecls.find((d) => d.property === 'column-gap');

  const rowsOk = baseRowGap?.value === '0' && baseColumnGap?.value === 'var(--pitch)';
  const railOk = railRowGap?.value === 'var(--pitch)' && railColumnGap?.value === '0';

  return [
    {
      ok: rowsOk,
      component: 'toolbar-band',
      invariant,
      assumption,
      found: `rows: row-gap ${baseRowGap?.value ?? 'absent'}, column-gap ${baseColumnGap?.value ?? 'absent'}`,
    },
    {
      ok: railOk,
      component: 'toolbar-band',
      invariant,
      assumption,
      found: `rail: row-gap ${railRowGap?.value ?? 'absent'}, column-gap ${railColumnGap?.value ?? 'absent'}`,
    },
  ];
}
