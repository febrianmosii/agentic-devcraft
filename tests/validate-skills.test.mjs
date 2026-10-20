import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  parseFrontmatter,
  headings,
  linkTargets,
  validateRepo,
  REQUIRED_SKILL_SECTIONS,
} from "../scripts/validate-skills.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function validSkillText(name, extra = "") {
  const sections = REQUIRED_SKILL_SECTIONS.map((s) => `## ${s}\n\nContent for ${s}.\n`).join("\n");
  return `---
name: ${name}
description: Does something specific. Use when the task mentions ${name}.
license: MIT
metadata:
  collection: test
---

# ${name}

${sections}
### MUST

- **A rule.**
  Prevents: x. Applies: y. Exception: z. Verify: w.
${extra}
`;
}

function validExampleText(skill) {
  return `# Scenario

**Skill:** ${skill}
**Status:** Illustrative

## Task
t
## Without the skill
w
## With the skill
w
## Why it matters
y
`;
}

function compatText(rows = "| Agent X | documented | a | b | |") {
  return `# Compat

| Agent | Status | Project path | Global path | Evidence |
|---|---|---|---|---|
${rows}
`;
}

/** Build a temporary repo with the given skills and options. */
function makeRepo({ skills = {}, examples = {}, readme = "# Readme\n", compat = compatText() } = {}) {
  const root = mkdtempSync(join(tmpdir(), "devcraft-"));
  mkdirSync(join(root, "skills"));
  for (const [dir, files] of Object.entries(skills)) {
    mkdirSync(join(root, "skills", dir), { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, "skills", dir, file)), { recursive: true });
      writeFileSync(join(root, "skills", dir, file), content);
    }
  }
  for (const [dir, files] of Object.entries(examples)) {
    mkdirSync(join(root, "examples", dir), { recursive: true });
    for (const [file, content] of Object.entries(files)) writeFileSync(join(root, "examples", dir, file), content);
  }
  writeFileSync(join(root, "README.md"), readme);
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "compatibility.md"), compat);
  return root;
}

function messages(report) {
  return report.errors.map((e) => `${e.file}: ${e.msg}`);
}

function withRepo(opts, fn) {
  const root = makeRepo(opts);
  try {
    return fn(validateRepo(root), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

test("parseFrontmatter: scalars, quotes, block scalars, nested metadata", () => {
  const { data, body, errors } = parseFrontmatter(`---
name: demo
description: >-
  Line one
  line two.
license: "MIT"
metadata:
  author: me
  version: "1.0"
---
body text`);
  assert.deepEqual(errors, []);
  assert.equal(data.name, "demo");
  assert.equal(data.description, "Line one line two.");
  assert.equal(data.license, "MIT");
  assert.deepEqual(data.metadata, { author: "me", version: "1.0" });
  assert.equal(body, "body text");
});

test("parseFrontmatter: literal block keeps newlines", () => {
  const { data } = parseFrontmatter(`---
description: |
  a
  b
---
`);
  assert.equal(data.description, "a\nb\n");
});

test("parseFrontmatter: rejects lists, deep nesting, duplicates, missing delimiters", () => {
  assert.match(parseFrontmatter("name: x\n---\n").errors[0], /start on line 1/);
  assert.match(parseFrontmatter("---\nname: x\n").errors[0], /not closed/);
  assert.match(parseFrontmatter("---\ntags:\n  - a\n---\n").errors.join(), /lists are not supported/);
  assert.match(parseFrontmatter("---\nmetadata:\n  deep:\n    x: 1\n---\n").errors.join(), /plain scalar/);
  assert.match(parseFrontmatter("---\nname: a\nname: b\n---\n").errors.join(), /duplicate key/);
});

test("parseFrontmatter: strips trailing comments on unquoted scalars only", () => {
  const { data } = parseFrontmatter(`---
name: demo # comment
description: "keep # this"
---
`);
  assert.equal(data.name, "demo");
  assert.equal(data.description, "keep # this");
});

// ---------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------

test("headings ignores fenced code blocks", () => {
  const md = "# A\n```\n# not a heading\n```\n## B ##\n";
  assert.deepEqual(headings(md), ["A", "B"]);
});

test("linkTargets finds links and images, skips code", () => {
  const md = "[a](x.md) ![i](img.png \"t\") `[c](no.md)`\n```\n[d](no2.md)\n```\n";
  assert.deepEqual(linkTargets(md), ["x.md", "img.png"]);
});

// ---------------------------------------------------------------------------
// validateRepo: skills
// ---------------------------------------------------------------------------

test("a well-formed repo validates with no errors", () => {
  withRepo(
    {
      skills: { alpha: { "SKILL.md": validSkillText("alpha") } },
      examples: { alpha: { "one.md": validExampleText("alpha") } },
    },
    (report) => {
      assert.deepEqual(messages(report), []);
      assert.deepEqual(report.warnings, []);
    },
  );
});

test("missing SKILL.md is an error", () => {
  withRepo({ skills: { alpha: { "notes.md": "x" } } }, (report) => {
    assert.match(messages(report).join("\n"), /skills\/alpha: missing SKILL.md/);
  });
});

test("name must match directory and follow the spec pattern", () => {
  withRepo(
    {
      skills: {
        alpha: { "SKILL.md": validSkillText("beta") },
        "Bad--Name": { "SKILL.md": validSkillText("Bad--Name") },
      },
    },
    (report) => {
      const m = messages(report).join("\n");
      assert.match(m, /`name` \(beta\) must match directory name \(alpha\)/);
      assert.match(m, /lowercase letters, digits and single hyphens/);
    },
  );
});

test("unknown frontmatter keys are rejected", () => {
  const text = validSkillText("alpha").replace("license: MIT", "license: MIT\npaths: src/**");
  withRepo({ skills: { alpha: { "SKILL.md": text } } }, (report) => {
    assert.match(messages(report).join("\n"), /unknown key `paths`/);
  });
});

test("description is required and bounded", () => {
  const noDesc = validSkillText("alpha").replace(/description: .*\n/, "");
  const longDesc = validSkillText("alpha").replace(/description: .*\n/, `description: ${"x".repeat(1025)}\n`);
  withRepo({ skills: { alpha: { "SKILL.md": noDesc } } }, (report) => {
    assert.match(messages(report).join("\n"), /`description` is required/);
  });
  withRepo({ skills: { alpha: { "SKILL.md": longDesc } } }, (report) => {
    assert.match(messages(report).join("\n"), /exceeds 1024/);
  });
});

test("duplicate skill names across directories are reported", () => {
  // Two directories cannot share a name on disk, but frontmatter can lie.
  withRepo(
    {
      skills: {
        alpha: { "SKILL.md": validSkillText("alpha") },
        beta: { "SKILL.md": validSkillText("alpha") },
      },
    },
    (report) => {
      const m = messages(report).join("\n");
      assert.match(m, /duplicate skill name `alpha`/);
    },
  );
});

test("required sections and a MUST rule are enforced", () => {
  const text = validSkillText("alpha").replace("## Anti-patterns", "## Antipatterns").replace(/MUST/g, "must");
  withRepo({ skills: { alpha: { "SKILL.md": text } } }, (report) => {
    const m = messages(report).join("\n");
    assert.match(m, /missing required section heading `Anti-patterns`/);
    assert.match(m, /at least one MUST rule/);
  });
});

test("line limit: error above 500, warning above 350", () => {
  const big = validSkillText("alpha", "\n".repeat(520));
  const medium = validSkillText("alpha", "\n".repeat(340));
  withRepo({ skills: { alpha: { "SKILL.md": big } } }, (report) => {
    assert.match(messages(report).join("\n"), /lines; keep it under 500/);
  });
  withRepo({ skills: { alpha: { "SKILL.md": medium } } }, (report) => {
    assert.deepEqual(messages(report), []);
    assert.match(report.warnings.map((w) => w.msg).join("\n"), /consider moving detail/);
  });
});

test("broken relative links and orphan references are reported", () => {
  withRepo(
    {
      skills: {
        alpha: {
          "SKILL.md": validSkillText("alpha", "See [missing](references/missing.md) and [ok](references/ok.md)."),
          "references/ok.md": "fine [back](../SKILL.md)",
          "references/orphan.md": "nobody links me",
        },
      },
    },
    (report) => {
      assert.match(messages(report).join("\n"), /broken link: references\/missing.md/);
      assert.match(report.warnings.map((w) => w.msg).join("\n"), /references\/orphan.md is not referenced/);
    },
  );
});

test("external links and anchors are not checked", () => {
  const text = validSkillText("alpha", "[a](https://example.com) [b](#rules) [c](mailto:x@y.z)");
  withRepo({ skills: { alpha: { "SKILL.md": text } } }, (report) => {
    assert.deepEqual(messages(report), []);
  });
});

test("nested SKILL.md inside a skill is an error", () => {
  withRepo(
    { skills: { alpha: { "SKILL.md": validSkillText("alpha"), "sub/SKILL.md": validSkillText("sub") } } },
    (report) => {
      assert.match(messages(report).join("\n"), /nested SKILL.md/);
    },
  );
});

// ---------------------------------------------------------------------------
// validateRepo: examples, docs, claims
// ---------------------------------------------------------------------------

test("examples must match a skill, have the sections and a status line", () => {
  const noStatus = validExampleText("alpha").replace("**Status:** Illustrative\n", "");
  const badStatus = validExampleText("alpha").replace("Illustrative", "Verified");
  const observedNoEvidence = validExampleText("alpha").replace("Illustrative", "Observed");
  const missingSection = validExampleText("alpha").replace("## Why it matters", "## Why");
  withRepo(
    {
      skills: { alpha: { "SKILL.md": validSkillText("alpha") } },
      examples: {
        alpha: { "a.md": noStatus, "b.md": badStatus, "c.md": observedNoEvidence, "d.md": missingSection },
        ghost: { "e.md": validExampleText("ghost") },
      },
    },
    (report) => {
      const m = messages(report).join("\n");
      assert.match(m, /examples\/alpha\/a.md: missing `\*\*Status:\*\*/);
      assert.match(m, /examples\/alpha\/b.md: invalid status `Verified`/);
      assert.match(m, /examples\/alpha\/c.md: Observed examples must include/);
      assert.match(m, /examples\/alpha\/d.md: missing required section heading `Why it matters`/);
      assert.match(m, /examples\/ghost: examples directory does not match any skill/);
    },
  );
});

test("banned compatibility claims are caught in README and skills", () => {
  const text = validSkillText("alpha", "This skill works with ALL agents.");
  withRepo(
    { skills: { alpha: { "SKILL.md": text } }, readme: "# R\n\nUniversal compatibility!\n" },
    (report) => {
      const m = messages(report).join("\n");
      assert.match(m, /skills\/alpha\/SKILL.md: unsupported compatibility claim: "works with all agents"/);
      assert.match(m, /README.md: unsupported compatibility claim: "universal compatibility"/);
    },
  );
});

test("compatibility table: statuses are validated and verified rows need evidence", () => {
  const rows = ["| A | verified | p | g | |", "| B | maybe | p | g | |", "| C | verified | p | g | tested 2026-10-20 |"].join(
    "\n",
  );
  withRepo({ skills: { alpha: { "SKILL.md": validSkillText("alpha") } }, compat: compatText(rows) }, (report) => {
    const m = messages(report).join("\n");
    assert.match(m, /row `A`: verified status requires evidence/);
    assert.match(m, /row `B`: status must be one of/);
    assert.doesNotMatch(m, /row `C`/);
  });
});

test("broken links in docs are reported", () => {
  withRepo(
    { skills: { alpha: { "SKILL.md": validSkillText("alpha") } }, readme: "# R\n[x](docs/nope.md)\n" },
    (report) => {
      assert.match(messages(report).join("\n"), /README.md: broken link: docs\/nope.md/);
    },
  );
});

// ---------------------------------------------------------------------------
// The real repository
// ---------------------------------------------------------------------------

test("the repository's own skills validate with zero errors and zero warnings", () => {
  const report = validateRepo(REPO_ROOT);
  assert.deepEqual(messages(report), []);
  assert.deepEqual(
    report.warnings.map((w) => `${w.file}: ${w.msg}`),
    [],
  );
});
