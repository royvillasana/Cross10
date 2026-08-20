import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The package driven the way an agent drives it: as a process, over stdio, in
 * JSON-RPC.
 *
 * Calling the catalog functions directly would prove the library works and say
 * nothing about the thing being delivered. What can go wrong here is the part
 * between: a tool that is registered but not listed, a schema that rejects a
 * shape the description invites, an error path that returns a result the caller
 * reads as success. So this speaks the protocol.
 */
const SERVER = join(dirname(fileURLToPath(import.meta.url)), "server.ts");

type Rpc = Readonly<{ id?: number; method?: string; result?: unknown; error?: unknown }>;

/**
 * One session: start the process, play the whole exchange, read the replies.
 *
 * Batched rather than request-by-request because the transport is a stream --
 * writing one line and waiting for one line would be re-implementing the
 * framing this is meant to exercise rather than assuming.
 */
async function session(requests: readonly unknown[]): Promise<readonly Rpc[]> {
  const child = spawn("npx", ["tsx", SERVER], {
    cwd: dirname(SERVER),
    stdio: ["pipe", "pipe", "pipe"],
  });

  const replies: Rpc[] = [];
  let buffered = "";

  const done = new Promise<void>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("utf8");
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        replies.push(JSON.parse(line) as Rpc);
      }
      // Every request is answered, so the exchange is over when the last id is.
      if (replies.filter((reply) => reply.id !== undefined).length >= requests.length) {
        resolve();
      }
    });
    child.on("error", reject);
    // A server that dies before answering fails here rather than at a timeout,
    // which is the difference between a diagnosis and a stopwatch.
    child.on("exit", (code) => {
      if (replies.length < requests.length) {
        reject(new Error(`server exited early with code ${code}`));
      }
    });
  });

  for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);

  try {
    await done;
  } finally {
    child.kill();
  }

  return replies;
}

const INITIALIZE = {
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
    protocolVersion: "2024-11-05",
  },
};

describe("the gallery served to an agent", () => {
  it("lists its tools with the descriptions an agent chooses by", async () => {
    const replies = await session([
      INITIALIZE,
      { id: 2, jsonrpc: "2.0", method: "tools/list", params: {} },
    ]);

    const listed = replies.find((reply) => reply.id === 2);
    const tools = (listed?.result as { tools?: { name: string; description?: string }[] })
      ?.tools;
    expect(tools?.map((tool) => tool.name).sort()).toEqual([
      "assemble_shader",
      "describe_composition",
      "list_compositions",
    ]);

    // The carriage distinction reaches the agent, because it is the one thing a
    // caller choosing between entries could otherwise get wrong.
    const list = tools?.find((tool) => tool.name === "list_compositions");
    expect(list?.description ?? "").toContain("evoke");
  }, 120_000);

  it("returns a shader for a named entry, with an override applied", async () => {
    const replies = await session([
      INITIALIZE,
      {
        id: 2,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: {}, name: "list_compositions" },
      },
      {
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: { id: "additive-bands" }, name: "assemble_shader" },
      },
      {
        id: 4,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {
            id: "additive-bands",
            overrides: [{ layer: 1, name: "count", value: 37 }],
          },
          name: "assemble_shader",
        },
      },
    ]);

    const textOf = (id: number): string =>
      (
        (replies.find((reply) => reply.id === id)?.result as {
          content?: { text?: string }[];
        })?.content ?? []
      )
        .map((part) => part.text ?? "")
        .join("");

    const catalog = JSON.parse(textOf(2)) as { id: string }[];
    expect(catalog.length).toBeGreaterThan(1);
    expect(catalog.some((entry) => entry.id === "additive-bands")).toBe(true);

    const plain = textOf(3);
    expect(plain).toContain("#version 300 es");
    expect(plain).toContain("void main()");
    // Values baked rather than left as uniforms to be supplied: the artifact is
    // the composition, not a program that could be one. Asserted against the
    // band layer rather than layer zero, which in this entry is the support the
    // separators open onto and carries no band count of its own.
    expect(plain).toMatch(/const float uLayer1_count = [\d.]+;/u);
    // Nothing of the studio travels with it.
    expect(plain).not.toContain("Croix10");
    expect(plain).not.toContain("Toolcraft");

    // The override reached the baked value rather than being accepted and
    // ignored, which is the failure that would leave a caller with source that
    // looks right and is not what they asked for.
    expect(textOf(4)).toContain("const float uLayer1_count = 37.0;");
    expect(textOf(4)).not.toBe(plain);
  }, 120_000);

  it("refuses an unknown entry and an unknown parameter, in words", async () => {
    const replies = await session([
      INITIALIZE,
      {
        id: 2,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: { id: "no-such-entry" }, name: "assemble_shader" },
      },
      {
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {
            id: "additive-bands",
            overrides: [{ layer: 0, name: "bandCount", value: 4 }],
          },
          name: "assemble_shader",
        },
      },
    ]);

    for (const id of [2, 3]) {
      const result = replies.find((reply) => reply.id === id)?.result as {
        content?: { text?: string }[];
        isError?: boolean;
      };
      expect(result?.isError, `call ${id} must report the failure`).toBe(true);
      expect(result?.content?.[0]?.text ?? "").not.toBe("");
    }

    // A misspelled parameter says what the composition actually carries, so the
    // next call can be right rather than another guess.
    const named = (
      replies.find((reply) => reply.id === 3)?.result as { content?: { text?: string }[] }
    )?.content?.[0]?.text;
    expect(named).toContain("count");
  }, 120_000);
});
