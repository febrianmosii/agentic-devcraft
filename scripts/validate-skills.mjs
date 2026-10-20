#!/usr/bin/env node
/**
 * Agentic DevCraft — skill collection validator.
 *
 * Zero-dependency. Requires Node.js 20+.
 *
 * Checks (see docs/validation.md for the full list):
 *   - every directory under skills/ contains a SKILL.md
 *   - SKILL.md frontmatter is valid against the Agent Skills specification
 *   - skill names are unique and match their directory
 *   - required body sections exist (structural consistency)
 *   - relative links and referenced files exist
 *   - reference files are actually referenced
 *   - examples follow the shared scenario structure
 *   - no unsupported compatibility claims (phrase scan + compatibility table)
 *
 * Usage:
 *   node scripts/validate-skills.mjs [--root <dir>] [--strict] [--json]
 *
 * Exit code 1 when errors are found (or warnings, with --strict).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Frontmatter keys defined by the Agent Skills specification. */
export const SPEC_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

/** Headings every SKILL.md body must contain (matched by exact text, any level). */
export const REQUIRED_SKILL_SECTIONS = [
  "Purpose",
  "When to use",
  "Rules",
  "Workflow",
  "Examples",
  "Anti-patterns",
  "Verification checklist",
  "Output",
];

/** Headings every examples/<skill>/<scenario>.md must contain. */
export const REQUIRED_EXAMPLE_SECTIONS = [
  "Task",
  "Without the skill",
  "With the skill",
  "Why it matters",
];

/** Allowed values of the status line in example scenarios. */
export const EXAMPLE_STATUSES = new Set(["Illustrative", "Observed"]);

/** Allowed values of the Status column in docs/compatibility.md. */
export const COMPAT_STATUSES = new Set(["verified", "documented", "untested"]);

/**
 * Phrases that overstate compatibility. Matched case-insensitively in
 * README.md, docs/, skills/ and examples/. Keep this list literal and short;
 * it is a guardrail, not a grammar checker.
 */
export const BANNED_CLAIMS = [
  "works with all agents",
  "works with every agent",
  "works with any agent",
  "compatible with all agents",
  "compatible with every agent",
  "universally compatible",
  "universal compatibility",
  "100% compatible",
  "guaranteed to work",
];

export const MAX_SKILL_LINES = 500;
export const WARN_SKILL_LINES = 350;

// ---------------------------------------------------------------------------
// Frontmatter parser (strict YAML subset)
// ---------------------------------------------------------------------------

/**
 * Parse the frontmatter block of a SKILL.md file.
 *
 * Supports a deliberately small subset of YAML, which is all the Agent Skills
 * spec needs: scalar `key: value` pairs, quoted scalars, `|`/`>` block scalars
 * (with optional `-` chomping), comments, and one level of nested mapping
 * (used by `metadata`). Lists and deeper nesting are rejected with a clear
 * message so authors keep frontmatter simple and portable.
 *
 * @param {string} text  full file content
 * @returns {{ data: Record<string, any>, body: string, errors: string[] }}
 */
export function parseFrontmatter(text) {
  const errors = [];
  const lines = text.split(/\r?\n/);

  if (lines[0] !== "---") {
    return { data: {}, body: text, errors: ["frontmatter must start on line 1 with `---`"] };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { data: {}, body: text, errors: ["frontmatter is not closed with `---`"] };
  }

  const fm = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n");
  const data = {};

  let i = 0;
  while (i < fm.length) {
    const raw = fm[i];
    const line = raw.replace(/\s+$/, "");
    if (line === "" || /^\s*#/.test(line)) {
      i++;
      continue;
    }
    if (/^\s/.test(line)) {
      errors.push(`line ${i + 2}: unexpected indentation (nested keys are only allowed under a mapping key)`);
      i++;
      continue;
    }
    if (/^\s*-\s/.test(line)) {
      errors.push(`line ${i + 2}: YAML lists are not supported in frontmatter; use a scalar or a one-level mapping`);
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);
    if (!m) {
      errors.push(`line ${i + 2}: cannot parse \`${line}\``);
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2] === undefined ? "" : m[2].trim();
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      errors.push(`duplicate key \`${key}\``);
    }

    // Block scalar: | or > with optional chomping indicator.
    if (/^[|>][+-]?$/.test(rest)) {
      const fold = rest.startsWith(">");
      const chomp = rest.endsWith("-");
      const block = [];
      let j = i + 1;
      while (j < fm.length && (fm[j] === "" || /^\s/.test(fm[j]))) {
        block.push(fm[j]);
        j++;
      }
      const indent = Math.min(
        ...block.filter((l) => l.trim() !== "").map((l) => l.match(/^\s*/)[0].length),
        Infinity,
      );
      const stripped = block.map((l) => (l.trim() === "" ? "" : l.slice(indent)));
      let value = fold ? stripped.join(" ").replace(/\s+/g, " ").trim() : stripped.join("\n");
      if (!fold && !chomp) value = value.replace(/\n+$/, "") + "\n";
      data[key] = value;
      i = j;
      continue;
    }

    // Nested one-level mapping.
    if (rest === "") {
      const map = {};
      let j = i + 1;
      let sawChild = false;
      while (j < fm.length) {
        const child = fm[j].replace(/\s+$/, "");
        if (child === "" || /^\s*#/.test(child)) {
          j++;
          continue;
        }
        if (!/^\s/.test(child)) break;
        if (/^\s*-\s/.test(child)) {
          errors.push(`line ${j + 2}: YAML lists are not supported in frontmatter; use a scalar or a one-level mapping`);
          sawChild = true;
          j++;
          continue;
        }
        const cm = child.match(/^\s+([A-Za-z0-9_.-]+):\s*(.*)$/);
        if (!cm) {
          errors.push(`line ${j + 2}: cannot parse nested entry \`${child.trim()}\` under \`${key}\``);
          j++;
          continue;
        }
        if (cm[2] === "" || /^[|>]/.test(cm[2])) {
          errors.push(`line ${j + 2}: \`${key}.${cm[1]}\` must be a plain scalar (only one level of nesting is supported)`);
          j++;
          continue;
        }
        map[cm[1]] = unquote(cm[2]);
        sawChild = true;
        j++;
      }
      if (!sawChild) {
        errors.push(`key \`${key}\` has no value`);
      }
      data[key] = map;
      i = j;
      continue;
    }

    data[key] = unquote(rest);
    i++;
  }

  return { data, body, errors };
}

function unquote(s) {
  const v = s.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  // Strip trailing comments on unquoted scalars.
  return v.replace(/\s+#.*$/, "");
}

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

/** Return heading texts (without `#`) in order, skipping fenced code blocks. */
export function headings(markdown) {
  const out = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

/** Extract markdown link / image targets, skipping fenced code blocks. */
export function linkTargets(markdown) {
  const out = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Remove inline code before matching links.
    const clean = line.replace(/`[^`]*`/g, "");
    const re = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m;
    while ((m = re.exec(clean))) out.push(m[1]);
  }
  return out;
}

function isExternal(target) {
  return /^(https?:|mailto:|#)/i.test(target);
}

/** Resolve a relative link and report whether it exists (ignoring anchors). */
function checkLink(fromFile, target) {
  const clean = target.split("#")[0];
  if (clean === "") return true;
  const abs = resolve(dirname(fromFile), decodeURIComponent(clean));
  return existsSync(abs);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class Report {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  error(file, msg) {
    this.errors.push({ file, msg });
  }
  warn(file, msg) {
    this.warnings.push({ file, msg });
  }
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function listDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !n.startsWith(".") && statSync(join(dir, n)).isDirectory())
    .sort();
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

function rel(root, file) {
  return relative(root, file).split(sep).join("/");
}

/**
 * Validate a single skill directory.
 * @returns {string|null} the skill name when frontmatter parsed, else null
 */
export function validateSkillDir(root, dir, report) {
  const skillFile = join(dir, "SKILL.md");
  const dirName = dir.split(sep).pop();
  const f = rel(root, skillFile);

  if (!existsSync(skillFile)) {
    report.error(rel(root, dir), "missing SKILL.md");
    return null;
  }

  const text = readFileSync(skillFile, "utf8");
  const { data, body, errors } = parseFrontmatter(text);
  for (const e of errors) report.error(f, `frontmatter: ${e}`);

  // --- frontmatter fields ---------------------------------------------------
  for (const key of Object.keys(data)) {
    if (!SPEC_KEYS.has(key)) {
      report.error(f, `frontmatter: unknown key \`${key}\` (only spec keys are allowed: ${[...SPEC_KEYS].join(", ")})`);
    }
  }

  const name = data.name;
  if (typeof name !== "string" || name.length === 0) {
    report.error(f, "frontmatter: `name` is required");
  } else {
    if (name.length > 64) report.error(f, "frontmatter: `name` exceeds 64 characters");
    if (!NAME_RE.test(name)) {
      report.error(f, "frontmatter: `name` must be lowercase letters, digits and single hyphens, not starting or ending with a hyphen");
    }
    if (name !== dirName) report.error(f, `frontmatter: \`name\` (${name}) must match directory name (${dirName})`);
  }

  const desc = data.description;
  if (typeof desc !== "string" || desc.trim().length === 0) {
    report.error(f, "frontmatter: `description` is required and must be non-empty");
  } else if (desc.length > 1024) {
    report.error(f, `frontmatter: \`description\` exceeds 1024 characters (${desc.length})`);
  } else if (!/\b(use when|when)\b/i.test(desc)) {
    report.warn(f, "frontmatter: `description` should say when to use the skill (e.g. \"Use when ...\")");
  }

  if ("compatibility" in data) {
    const c = data.compatibility;
    if (typeof c !== "string" || c.length === 0 || c.length > 500) {
      report.error(f, "frontmatter: `compatibility` must be a 1-500 character string");
    }
  }
  if ("license" in data && typeof data.license !== "string") {
    report.error(f, "frontmatter: `license` must be a string");
  }
  if ("allowed-tools" in data && typeof data["allowed-tools"] !== "string") {
    report.error(f, "frontmatter: `allowed-tools` must be a space-separated string");
  }
  if ("metadata" in data) {
    const m = data.metadata;
    if (typeof m !== "object" || m === null) {
      report.error(f, "frontmatter: `metadata` must be a mapping of string keys to string values");
    } else {
      for (const [k, v] of Object.entries(m)) {
        if (typeof v !== "string") report.error(f, `frontmatter: metadata.${k} must be a string`);
      }
    }
  }

  // --- body -----------------------------------------------------------------
  const lineCount = text.split(/\r?\n/).length;
  if (lineCount > MAX_SKILL_LINES) {
    report.error(f, `SKILL.md has ${lineCount} lines; keep it under ${MAX_SKILL_LINES} and move detail to references/`);
  } else if (lineCount > WARN_SKILL_LINES) {
    report.warn(f, `SKILL.md has ${lineCount} lines; consider moving detail to references/`);
  }

  const hs = headings(body);
  for (const required of REQUIRED_SKILL_SECTIONS) {
    if (!hs.some((h) => h.toLowerCase() === required.toLowerCase())) {
      report.error(f, `missing required section heading \`${required}\``);
    }
  }
  if (!/\bMUST\b/.test(body)) report.error(f, "body must contain at least one MUST rule");

  // --- links and references -------------------------------------------------
  const referenced = new Set();
  for (const target of linkTargets(body)) {
    if (isExternal(target)) continue;
    if (!checkLink(skillFile, target)) {
      report.error(f, `broken link: ${target}`);
    } else {
      referenced.add(resolve(dirname(skillFile), target.split("#")[0]));
    }
  }
  for (const sub of ["references", "scripts", "assets"]) {
    const subDir = join(dir, sub);
    for (const file of walkFiles(subDir)) {
      if (!referenced.has(resolve(file))) {
        report.warn(f, `${rel(root, file)} is not referenced from SKILL.md`);
      }
      if (file.endsWith(".md")) {
        for (const target of linkTargets(readFileSync(file, "utf8"))) {
          if (!isExternal(target) && !checkLink(file, target)) {
            report.error(rel(root, file), `broken link: ${target}`);
          }
        }
      }
    }
  }
  // Nested SKILL.md files would shadow or be shadowed by this one.
  for (const file of walkFiles(dir)) {
    if (file !== skillFile && file.endsWith("SKILL.md")) {
      report.error(rel(root, file), "nested SKILL.md inside a skill directory is not allowed");
    }
  }

  return typeof name === "string" ? name : null;
}

export function validateExamples(root, skillNames, report) {
  const examplesDir = join(root, "examples");
  if (!existsSync(examplesDir)) return;
  for (const skillDirName of listDirs(examplesDir)) {
    const dir = join(examplesDir, skillDirName);
    if (!skillNames.has(skillDirName)) {
      report.error(rel(root, dir), `examples directory does not match any skill in skills/`);
    }
    const files = readdirSync(dir).filter((n) => n.endsWith(".md")).sort();
    if (files.length === 0) report.warn(rel(root, dir), "no example scenarios found");
    for (const name of files) {
      const file = join(dir, name);
      const f = rel(root, file);
      const text = readFileSync(file, "utf8");
      const hs = headings(text);
      for (const required of REQUIRED_EXAMPLE_SECTIONS) {
        if (!hs.some((h) => h.toLowerCase() === required.toLowerCase())) {
          report.error(f, `missing required section heading \`${required}\``);
        }
      }
      const status = text.match(/^\*\*Status:\*\*\s*(\w+)/m);
      if (!status) {
        report.error(f, "missing `**Status:** Illustrative|Observed` line near the top");
      } else if (!EXAMPLE_STATUSES.has(status[1])) {
        report.error(f, `invalid status \`${status[1]}\` (allowed: ${[...EXAMPLE_STATUSES].join(", ")})`);
      } else if (status[1] === "Observed" && !/^\*\*Observed with:\*\*\s*\S/m.test(text)) {
        report.error(f, "Observed examples must include an `**Observed with:**` line naming agent, model and date");
      }
      for (const target of linkTargets(text)) {
        if (!isExternal(target) && !checkLink(file, target)) report.error(f, `broken link: ${target}`);
      }
    }
  }
}

export function validateDocs(root, report) {
  const files = [join(root, "README.md"), join(root, "CONTRIBUTING.md"), ...walkFiles(join(root, "docs"))].filter(
    (p) => existsSync(p) && p.endsWith(".md"),
  );
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const target of linkTargets(text)) {
      if (!isExternal(target) && !checkLink(file, target)) report.error(rel(root, file), `broken link: ${target}`);
    }
  }
}

export function validateClaims(root, report) {
  const files = [
    join(root, "README.md"),
    ...walkFiles(join(root, "docs")),
    ...walkFiles(join(root, "skills")),
    ...walkFiles(join(root, "examples")),
  ].filter((p) => existsSync(p) && p.endsWith(".md"));

  for (const file of files) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const phrase of BANNED_CLAIMS) {
      if (text.includes(phrase)) {
        report.error(rel(root, file), `unsupported compatibility claim: "${phrase}"`);
      }
    }
  }

  // Compatibility table: every `verified` row needs evidence.
  const compat = join(root, "docs", "compatibility.md");
  if (!existsSync(compat)) {
    report.warn("docs/compatibility.md", "missing compatibility document");
    return;
  }
  const rows = readFileSync(compat, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("|"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const header = rows[0] || [];
  const statusIdx = header.findIndex((h) => /^status$/i.test(h));
  const evidenceIdx = header.findIndex((h) => /^evidence$/i.test(h));
  if (statusIdx === -1 || evidenceIdx === -1) {
    report.error("docs/compatibility.md", "compatibility table needs `Status` and `Evidence` columns");
    return;
  }
  for (const row of rows.slice(2)) {
    const status = (row[statusIdx] || "").replace(/`/g, "").toLowerCase();
    if (!COMPAT_STATUSES.has(status)) {
      report.error("docs/compatibility.md", `row \`${row[0]}\`: status must be one of ${[...COMPAT_STATUSES].join(", ")}`);
    }
    if (status === "verified" && !(row[evidenceIdx] || "").trim()) {
      report.error("docs/compatibility.md", `row \`${row[0]}\`: verified status requires evidence`);
    }
  }
}

/**
 * Validate the whole repository.
 * @param {string} root  repository root
 * @returns {Report}
 */
export function validateRepo(root) {
  const report = new Report();
  const skillsDir = join(root, "skills");
  if (!existsSync(skillsDir)) {
    report.error("skills/", "directory not found");
    return report;
  }
  const names = new Map();
  const dirs = listDirs(skillsDir);
  if (dirs.length === 0) report.error("skills/", "no skills found");
  for (const d of dirs) {
    const dir = join(skillsDir, d);
    const name = validateSkillDir(root, dir, report);
    if (name) {
      if (names.has(name)) report.error(rel(root, dir), `duplicate skill name \`${name}\` (also in ${names.get(name)})`);
      names.set(name, rel(root, dir));
    }
  }
  validateExamples(root, new Set(dirs), report);
  validateDocs(root, report);
  validateClaims(root, report);
  return report;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const args = argv.slice(2);
  let root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let strict = false;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") root = resolve(args[++i]);
    else if (args[i] === "--strict") strict = true;
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log("usage: validate-skills.mjs [--root <dir>] [--strict] [--json]");
      return 0;
    } else {
      console.error(`unknown argument: ${args[i]}`);
      return 2;
    }
  }

  const report = validateRepo(root);
  const skillCount = listDirs(join(root, "skills")).length;

  if (json) {
    console.log(JSON.stringify({ root, skills: skillCount, errors: report.errors, warnings: report.warnings }, null, 2));
  } else {
    for (const w of report.warnings) console.log(`WARN  ${w.file}: ${w.msg}`);
    for (const e of report.errors) console.log(`ERROR ${e.file}: ${e.msg}`);
    console.log(
      `\n${skillCount} skill(s) checked: ${report.errors.length} error(s), ${report.warnings.length} warning(s)${strict ? " [strict]" : ""}`,
    );
  }
  const failed = report.errors.length > 0 || (strict && report.warnings.length > 0);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv));
}
