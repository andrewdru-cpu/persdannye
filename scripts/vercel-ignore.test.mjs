import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const script = path.resolve("scripts/vercel-ignore.sh");

function runPaths(paths, env = {}) {
  const result = spawnSync("sh", [script, "--paths"], {
    input: paths.length ? `${paths.join("\n")}\n` : "",
    encoding: "utf8",
    env: { PATH: process.env.PATH, VERCEL_ENV: "preview", ...env },
  });
  return result.status;
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  assert.equal(result.status, 0, result.stderr);
}

describe("vercel ignore command", () => {
  it("skips a preview diff of docs markdown, tests, and github files", () => {
    assert.equal(
      runPaths([
        "docs/guide.md",
        "docs/nested/a.md",
        "content/landing-copy.test.mts",
        "tests/foo.ts",
        "src/__tests__/bar.ts",
        ".github/workflows/ci.yml",
      ]),
      0,
    );
  });

  it("builds when any path is outside the skip list", () => {
    assert.equal(runPaths(["docs/guide.md", "app/page.tsx"]), 1);
    assert.equal(runPaths(["README.md"]), 1);
    assert.equal(runPaths(["docs/diagram.png"]), 1);
  });

  it("builds production even when every path would be skipped", () => {
    assert.equal(runPaths(["docs/guide.md"], { VERCEL_ENV: "production" }), 1);
  });

  it("builds when git history is missing", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "vercel-ignore-nogit-"));
    const result = spawnSync("sh", [script], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH, VERCEL_ENV: "preview", GIT_DIR: cwd, GIT_WORK_TREE: cwd },
    });
    assert.equal(result.status, 1);
  });

  it("uses HEAD^ and skips a docs-only commit, then builds for source", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "vercel-ignore-git-"));
    git(cwd, ["init"]);
    mkdirSync(path.join(cwd, "docs"));
    writeFileSync(path.join(cwd, "docs", "a.md"), "a\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "first"]);
    writeFileSync(path.join(cwd, "docs", "a.md"), "b\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "docs"]);

    const skipped = spawnSync("sh", [script], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH, VERCEL_ENV: "preview" },
    });
    assert.equal(skipped.status, 0, skipped.stderr);

    const forced = spawnSync("sh", [script], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH, VERCEL_ENV: "production" },
    });
    assert.equal(forced.status, 1);

    writeFileSync(path.join(cwd, "page.tsx"), "export {}\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "source"]);
    const built = spawnSync("sh", [script], {
      cwd,
      encoding: "utf8",
      env: { PATH: process.env.PATH, VERCEL_ENV: "preview" },
    });
    assert.equal(built.status, 1, built.stderr);
  });

  it("builds when the previous sha is not in the clone", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "vercel-ignore-sha-"));
    git(cwd, ["init"]);
    writeFileSync(path.join(cwd, "a.txt"), "a\n");
    git(cwd, ["add", "."]);
    git(cwd, ["commit", "-m", "first"]);
    const result = spawnSync("sh", [script], {
      cwd,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        VERCEL_ENV: "preview",
        VERCEL_GIT_PREVIOUS_SHA: "0123456789abcdef0123456789abcdef01234567",
      },
    });
    assert.equal(result.status, 1);
  });
});
