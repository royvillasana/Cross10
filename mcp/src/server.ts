#!/usr/bin/env tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  findStudioCatalogEntry,
  studioCatalog,
  studioEntryParameters,
  studioEntrySource,
  studioOverrideNames,
} from "./catalog";

/**
 * The studio's delivery path for agents.
 *
 * Three tools, and the shape of them is the argument. An agent choosing a
 * composition needs to know what the library holds; an agent overriding a
 * parameter needs to know what the parameters *are*; and what it wants back is
 * source it can compile, not a picture. So: list, describe, assemble.
 *
 * Read-only by construction. Nothing here writes a file, mutates the studio, or
 * reaches the network -- the whole surface is a function of the product's own
 * library, so a caller cannot use this to change anything, only to be given
 * what the library already says.
 */
const server = new McpServer({
  name: "croix10",
  title: "Croix10 shader gallery",
  version: "0.1.0",
});

server.registerTool(
  "list_compositions",
  {
    description:
      "List the compositions the Croix10 gallery holds. Each entry names the " +
      "series it works in and whether a flat rectangle carries that " +
      "investigation or only evokes it -- four of the series are rooms a " +
      "visitor walks through, and a picture of one is not a rendering of it. " +
      "Palettes are the studio's own and do not reproduce any artist's.",
    inputSchema: {},
    title: "List compositions",
  },
  () => ({
    content: [{ text: JSON.stringify(studioCatalog(), null, 2), type: "text" }],
  }),
);

server.registerTool(
  "describe_composition",
  {
    description:
      "Describe one composition: its layers in draw order, bottom first, and " +
      "every parameter each layer carries with its current value. The names " +
      "are the ones an override uses.",
    inputSchema: {
      id: z.string().describe("The composition id, from list_compositions."),
    },
    title: "Describe a composition",
  },
  ({ id }) => {
    const preset = findStudioCatalogEntry(id);
    if (!preset) {
      return {
        content: [{ text: `No composition is named "${id}".`, type: "text" }],
        isError: true,
      };
    }

    return {
      content: [
        {
          text: JSON.stringify(
            {
              id: preset.id,
              label: preset.label,
              layers: studioEntryParameters(preset),
              overridable: studioOverrideNames(preset),
            },
            null,
            2,
          ),
          type: "text",
        },
      ],
    };
  },
);

server.registerTool(
  "assemble_shader",
  {
    description:
      "Return the assembled GLSL for a composition, with the author's values " +
      "baked in, optionally overriding named parameters. The source is a " +
      "complete fragment shader: it compiles without this package, carries no " +
      "attribution or identifier, and needs no host beyond a full-screen " +
      "triangle and the resolution uniform it declares.",
    inputSchema: {
      id: z.string().describe("The composition id, from list_compositions."),
      overrides: z
        .array(
          z.object({
            layer: z.number().int().min(0).describe("Layer index, bottom first."),
            name: z.string().describe("Parameter name, from describe_composition."),
            value: z
              .unknown()
              .describe("The value as a control holds it: a hex colour, an option's own string, or a number."),
          }),
        )
        .optional()
        .describe("Parameters to change before assembling."),
    },
    title: "Assemble a shader",
  },
  ({ id, overrides }) => {
    const preset = findStudioCatalogEntry(id);
    if (!preset) {
      return {
        content: [{ text: `No composition is named "${id}".`, type: "text" }],
        isError: true,
      };
    }

    // A misspelled parameter fails rather than being ignored. An override that
    // silently does nothing is the worst outcome here: the caller gets source
    // that looks right and is not the thing they asked for.
    const known = new Set(studioOverrideNames(preset));
    const unknown = (overrides ?? []).filter((override) => !known.has(override.name));
    if (unknown.length > 0) {
      return {
        content: [
          {
            text:
              `Unknown parameter${unknown.length === 1 ? "" : "s"}: ` +
              `${unknown.map((override) => override.name).join(", ")}. ` +
              `This composition carries: ${[...known].join(", ")}.`,
            type: "text",
          },
        ],
        isError: true,
      };
    }

    const outOfRange = (overrides ?? []).filter(
      (override) => override.layer >= preset.layers.length,
    );
    if (outOfRange.length > 0) {
      return {
        content: [
          {
            text: `This composition has ${preset.layers.length} layer${
              preset.layers.length === 1 ? "" : "s"
            }, numbered from 0.`,
            type: "text",
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        { text: studioEntrySource({ overrides, preset }), type: "text" },
      ],
    };
  },
);

await server.connect(new StdioServerTransport());
