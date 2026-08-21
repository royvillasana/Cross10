import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect } from "@playwright/test";

import { openStudioSingleLayer } from "./studio-product-helpers";
import { test } from "./toolcraft-product-test";

/**
 * The one claim the MCP package cannot make for itself: that what it hands back
 * compiles.
 *
 * Its own tests speak the protocol and assert the *shape* of the source -- a
 * version directive, a main, baked constants, no attribution. None of that is
 * the same as a driver accepting it, and the difference is exactly where a
 * delivered shader fails: a program that is well-formed to a reader and refused
 * by a compiler is the failure mode this product's whole artifact story rests
 * on avoiding.
 *
 * So the source is produced by the package, in Node, and compiled here in a
 * real WebGL2 context. Nothing of the studio is involved in the compile: the
 * page supplies a context and a vertex shader and nothing else, which is the
 * "compiles without the studio's chunk registry" claim made against a compiler
 * rather than against a string search.
 */
const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "mcp");

/** The package driven the way a caller would, then read for its source. */
function assembleThroughPackage(id: string, overrides: unknown[] = []): string {
  return execFileSync(
    "npx",
    [
      "tsx",
      "-e",
      [
        `import { findStudioCatalogEntry, studioEntrySource } from "./src/catalog";`,
        `const preset = findStudioCatalogEntry(${JSON.stringify(id)});`,
        `if (!preset) throw new Error("no entry");`,
        `process.stdout.write(studioEntrySource({ overrides: ${JSON.stringify(
          overrides,
        )}, preset }));`,
      ].join("\n"),
    ],
    { cwd: PACKAGE, encoding: "utf8", env: childEnvironment(), maxBuffer: 32 * 1024 * 1024 },
  );
}

/**
 * The environment for a child run from the package directory.
 *
 * `NODE_OPTIONS` is inherited, and the stable suite sets it to
 * `--require ./tools/toolcraft-keepalive-preload.cjs` -- a path relative to the
 * repository root. A child started with `cwd` set to this package resolves that
 * against the wrong directory and dies before it runs, which is a failure with
 * nothing to do with what is being tested and which only appears under
 * `test:browser:stable`. Dropping the variable is right rather than expedient:
 * the preload keeps a *browser* connection alive, and this child is a Node
 * process assembling a string.
 */
function childEnvironment(): NodeJS.ProcessEnv {
  const { NODE_OPTIONS: _dropped, ...rest } = process.env;
  return rest;
}

test("browser: studio mcp source compiles standalone in a real context", async ({
  page,
}) => {
  test.setTimeout(300_000);

  // The page is here only to hold a GL context. The studio is opened because
  // that is what serves the page, not because the compile uses it.
  await openStudioSingleLayer(page);

  const compile = async (source: string): Promise<string> =>
    page.evaluate((fragmentSource) => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (!gl) return "nogl";

      const shader = gl.createShader(gl.FRAGMENT_SHADER);
      if (!shader) return "noshader";
      gl.shaderSource(shader, fragmentSource);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return `fragment: ${gl.getShaderInfoLog(shader) ?? "unknown"}`;
      }

      // Linked as well as compiled, against a vertex shader the source does not
      // ship with: a fragment shader that compiles alone can still fail to link
      // against the varying it expects, which is a delivery failure rather than
      // a syntax one.
      const vertex = gl.createShader(gl.VERTEX_SHADER);
      if (!vertex) return "novertex";
      gl.shaderSource(
        vertex,
        `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  vec2 position = positions[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`,
      );
      gl.compileShader(vertex);
      if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS)) return "hostvertex";

      const program = gl.createProgram();
      if (!program) return "noprogram";
      gl.attachShader(program, vertex);
      gl.attachShader(program, shader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return `link: ${gl.getProgramInfoLog(program) ?? "unknown"}`;
      }

      return "ok";
    }, source);

  // Every entry in the gallery, not a sample. What the package promises is that
  // *a composition* comes back as source that compiles, and an entry nobody
  // tried is exactly where a layer combination first fails to.
  const catalog = JSON.parse(
    execFileSync(
      "npx",
      [
        "tsx",
        "-e",
        `import { studioCatalog } from "./src/catalog"; process.stdout.write(JSON.stringify(studioCatalog().map((entry) => entry.id)));`,
      ],
      { cwd: PACKAGE, encoding: "utf8", env: childEnvironment() },
    ),
  ) as string[];

  expect(catalog.length).toBeGreaterThan(1);

  for (const id of catalog) {
    expect(await compile(assembleThroughPackage(id)), `${id} must compile`).toBe("ok");
  }

  // And with an override applied, since an override changes a baked literal and
  // a badly formatted one is a compile error rather than a wrong picture.
  expect(
    await compile(
      assembleThroughPackage("additive-bands", [
        { layer: 1, name: "count", value: 37 },
        { layer: 1, name: "colorA", value: "#ff0000" },
      ]),
    ),
    "an overridden composition must compile too",
  ).toBe("ok");
});
