import type { Page } from "@playwright/test";

import { getToolcraftControlFieldByTarget } from "./browser-control-target-helpers";
import {
  expectToolcraftTimelineDuration,
  expectToolcraftTimelineLoop,
  expectToolcraftTimelinePauseResume,
  expectToolcraftTimelineRenderedFrame,
  expectToolcraftTimelineScrub,
  type ToolcraftTimelineLoopCycleProof,
} from "./browser-timeline-evidence-helpers";
import {
  chooseCroix10Engine as chooseEngine,
  croix10Scrubber,
  croix10Transport,
  jumpCroix10Slider,
  openCroix10,
  pauseCroix10Timeline,
  playCroix10Timeline,
  readCroix10FieldSignature,
  scrubCroix10Timeline,
  setCroix10TimelineDuration,
  settleCroix10Field,
  showCroix10ExtendedTimeline,
} from "./croix10-product-helpers";
import { expect, test } from "./toolcraft-product-test";

/**
 * Timeline playback acceptance domain.
 *
 * Everything here is driven through the runtime's own transport, because that is
 * the only transport this product has: it declares no play, pause, scrub, or
 * duration control of its own, and adding one would be the thing the timeline
 * contract exists to prevent.
 *
 * The measurements read the backing buffer rather than a screenshot. Two of the
 * claims — that the seam matches, and that a paused field holds still — are
 * claims that two renders are the *same* render, and a resampled element capture
 * cannot establish that.
 */

/** Where the loop proof stashes its Node-collected samples for the observation. */
const LOOP_PROOF_ATTRIBUTE = "data-croix10-loop-proof";

type Croix10PlaybackReading = {
  currentTimeSeconds: number;
  outputSignature: string;
  playing: boolean;
  renderedCycleDurationSeconds: number;
  timelineDurationSeconds: number;
};

type Croix10ProofWindow = {
  croix10Playback: (root: HTMLElement) => Croix10PlaybackReading;
};

/**
 * Installs the whole playback reading inside the page.
 *
 * A proof observation is serialised into the browser and cannot close over a
 * Node-side helper, so everything an observation needs — the transport state, the
 * scrubber range, the renderer's published cycle, and the same backing-buffer
 * readback `readCroix10FieldSignature` performs — is defined once on the page and
 * called by name. Survives for the life of the document, which is the life of
 * this proof.
 */
async function installCroix10PlaybackObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const readSignature = (root: HTMLElement): string => {
      const canvas = root.querySelector(
        "[data-toolcraft-product-output]",
      ) as HTMLCanvasElement | null;
      if (!canvas) return "no-canvas";
      const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
      if (!gl) return "no-webgl2";
      const { height, width } = canvas;
      if (width === 0 || height === 0) return "empty";
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let sum = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        sum += pixels[index] + pixels[index + 1] + pixels[index + 2];
      }
      let hash = 0;
      const sampled = Math.min(pixels.length, 400_000);
      for (let index = 0; index < sampled; index += 1) {
        hash = (hash * 31 + pixels[index]) >>> 0;
      }
      return `${width}x${height}:${sum}:${hash}`;
    };

    (window as unknown as { croix10Playback: unknown }).croix10Playback = (
      root: HTMLElement,
    ) => {
      const scrubber = root.querySelector(
        '[role="slider"][aria-label="Playback position"]',
      );
      const canvas = root.querySelector(
        "[data-toolcraft-product-output]",
      ) as HTMLElement | null;
      return {
        currentTimeSeconds: Number(
          scrubber?.getAttribute("aria-valuenow") ?? Number.NaN,
        ),
        outputSignature: readSignature(root),
        playing:
          root.querySelector('button[aria-label="Pause playback"]') !== null,
        renderedCycleDurationSeconds: Number(
          canvas?.dataset.croix10CycleSeconds ?? Number.NaN,
        ),
        timelineDurationSeconds: Number(
          scrubber?.getAttribute("aria-valuemax") ?? Number.NaN,
        ),
      };
    };
  });
}

/** The scrubber's current time and the field rendered at it. */
async function readScrubState(
  page: Page,
): Promise<{ currentTimeSeconds: number; outputSignature: string }> {
  return {
    currentTimeSeconds: Number(
      await croix10Scrubber(page).getAttribute("aria-valuenow"),
    ),
    outputSignature: await readCroix10FieldSignature(page),
  };
}

/**
 * Samples one full loop during real playback.
 *
 * Phases are read from the runtime scrubber and normalised against the duration
 * the *renderer* published, so a cycle that walked a different length than the
 * scrubber advertises cannot pass. Sampling stops one step after the first wrap,
 * because the proof requires exactly one.
 */
async function sampleLoopCycle(
  page: Page,
  durationSeconds: number,
): Promise<ToolcraftTimelineLoopCycleProof> {
  await pauseCroix10Timeline(page);
  await scrubCroix10Timeline(page, "Home");
  const seamStartSignature = await readCroix10FieldSignature(page);
  await scrubCroix10Timeline(page, "End");
  const seamEndSignature = await readCroix10FieldSignature(page);

  await scrubCroix10Timeline(page, "Home");
  await playCroix10Timeline(page);
  const phases: number[] = [];
  // Sixteen samples per nominal cycle, so the reading before a wrap lands well
  // above 0.75 and the one after it well below 0.25 even when several are
  // dropped. A sample that is neither forward nor a clean wrap is discarded and
  // the walk self-heals on the following cycle.
  const stepMs = Math.max(100, Math.round((durationSeconds * 1000) / 16));
  // Wall clock is not the budget. Playback advances on animation frames, which
  // the browser throttles while other workers are saturating the GPU, so a 4s
  // cycle can take far longer than 4s of real time to complete under suite load.
  const deadline = Date.now() + 120_000;
  let wrapped = false;
  let advanced = false;
  while (!wrapped && Date.now() < deadline) {
    const now = Number(await croix10Scrubber(page).getAttribute("aria-valuenow"));
    const phase = (now / durationSeconds) % 1;
    const previous = phases.at(-1);
    if (previous === undefined) {
      phases.push(phase);
    } else if (phase > previous) {
      phases.push(phase);
      advanced = true;
    } else if (previous >= 0.75 && phase <= 0.25 && phases.length >= 4) {
      phases.push(phase);
      wrapped = true;
    }
    if (!wrapped) await page.waitForTimeout(stepMs);
  }
  await pauseCroix10Timeline(page);
  // Separated so a failure names which half broke: a clock that never moved is a
  // transport problem, while one that moved without closing is a pacing problem.
  expect(
    advanced,
    `Playback should advance the ${durationSeconds}s timeline while playing.`,
  ).toBe(true);
  expect(
    wrapped,
    `Playback should complete one ${durationSeconds}s cycle and wrap; sampled ${phases.length} phases ending at ${phases.at(-1)}.`,
  ).toBe(true);

  return {
    durationSeconds,
    normalizedPhases: phases,
    seamEndSignature,
    seamStartSignature,
  };
}

test("browser: croix10 plays, scrubs, and loops the drifting field seamlessly", async ({
  page,
}) => {
  // Full-buffer readbacks across several transport states, plus two sampled
  // playback cycles, do not fit the default per-test budget when the whole suite
  // runs on one worker.
  test.setTimeout(600_000);

  const session = await openCroix10(page);
  await showCroix10ExtendedTimeline(page);
  await chooseEngine(page, "Chromointerférence");
  // The maximum rate. The seam claim holds at every integer rate — that is what
  // the integer domain buys — and the fastest one makes the smallest scrub step
  // move the beat far enough to be unmistakable rather than marginal.
  await jumpCroix10Slider(
    await getToolcraftControlFieldByTarget(page, "interference.driftCycles"),
    "End",
  );
  await settleCroix10Field(page);

  await installCroix10PlaybackObserver(page);
  const observeScrub = session.observe((root) => {
    const reading = (window as unknown as Croix10ProofWindow).croix10Playback(root);
    return {
      currentTimeSeconds: reading.currentTimeSeconds,
      outputSignature: reading.outputSignature,
    };
  });

  // Scrub: the playhead lands on a time and the field is that time's field.
  //
  // The expected frame is measured first and then scrubbed away from, so the
  // claim is that scrubbing back to a time reproduces that time's field exactly,
  // rather than merely that something changed.
  await scrubCroix10Timeline(page, "Home");
  const first = await readCroix10FieldSignature(page);
  expect(first).not.toBe("no-webgl2");
  await scrubCroix10Timeline(page, "ArrowRight");
  const scrubbed = await readScrubState(page);
  expect(scrubbed.outputSignature).not.toBe(first);

  await scrubCroix10Timeline(page, "Home");
  await expectToolcraftTimelineScrub(
    observeScrub,
    session.action(async () => {
      await scrubCroix10Timeline(page, "ArrowRight");
    }),
    scrubbed,
    { requirementId: "timeline.playback", timeoutMs: 20_000 },
  );

  // The rendered frame at a scrubbed time is the product's own output, reproved
  // as a product-observable change rather than as a transport side effect.
  await scrubCroix10Timeline(page, "Home");
  await expectToolcraftTimelineRenderedFrame(
    session.observe((root) => (window as unknown as Croix10ProofWindow).croix10Playback(root).outputSignature),
    session.action(async () => {
      await scrubCroix10Timeline(page, "ArrowRight");
    }),
    scrubbed.outputSignature,
    { requirementId: "timeline.playback", timeoutMs: 20_000 },
  );

  // Pause holds. Play, let the clock advance, pause, and read twice: a paused
  // field is byte-identical to itself, which a still-running clock would break.
  await scrubCroix10Timeline(page, "Home");
  await playCroix10Timeline(page);
  await expect
    .poll(async () => Number(await croix10Scrubber(page).getAttribute("aria-valuenow")), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);

  await expectToolcraftTimelinePauseResume(
    session.observe((root) => {
      const reading = (window as unknown as Croix10ProofWindow).croix10Playback(root);
      return {
        currentTimeSeconds: reading.currentTimeSeconds,
        outputSignature: reading.outputSignature,
        playing: reading.playing,
      };
    }),
    session.action(async () => {
      await croix10Transport(page, "Pause playback").click();
    }),
    session.action(async () => {
      await croix10Transport(page, "Play playback").click();
    }),
    { pauseWindowMs: 600, requirementId: "timeline.playback", timeoutMs: 20_000 },
  );

  await pauseCroix10Timeline(page);
  await settleCroix10Field(page);
  const paused = await readCroix10FieldSignature(page);
  await page.waitForTimeout(600);
  expect(await readCroix10FieldSignature(page)).toBe(paused);

  // The seam: the loop's last instant renders the frame its first instant does.
  // End scrubs to exactly the duration, which the loop maps back onto zero.
  await scrubCroix10Timeline(page, "Home");
  const atStart = await readCroix10FieldSignature(page);
  await scrubCroix10Timeline(page, "End");
  expect(await readCroix10FieldSignature(page)).toBe(atStart);

  // Duration is loop length, not scene design: after editing it the composition
  // at the start of the loop is unchanged, and the seam still matches.
  //
  // Both halves are read: the runtime scrubber's range and the cycle the renderer
  // published. A proof that read only the scrubber would assert the runtime
  // agrees with itself and say nothing about what was drawn.
  const observeDuration = session.observe((root) => {
    const reading = (window as unknown as Croix10ProofWindow).croix10Playback(root);
    return {
      renderedCycleDurationSeconds: reading.renderedCycleDurationSeconds,
      timelineDurationSeconds: reading.timelineDurationSeconds,
    };
  });
  await expectToolcraftTimelineDuration(
    observeDuration,
    session.action(async () => {
      await setCroix10TimelineDuration(page, 4);
    }),
    4,
    { requirementId: "timeline.playback", timeoutMs: 20_000 },
  );

  await scrubCroix10Timeline(page, "Home");
  expect(await readCroix10FieldSignature(page)).toBe(atStart);
  await scrubCroix10Timeline(page, "End");
  expect(await readCroix10FieldSignature(page)).toBe(atStart);

  // The loop itself, sampled during real playback at two different durations:
  // forward-only motion, exactly one wrap, and a seam that stitches — reproved
  // after the duration edit, which is what makes the edit a loop-length change
  // rather than a scene change.
  const resized = await sampleLoopCycle(page, 4);
  await setCroix10TimelineDuration(page, 8);
  const initial = await sampleLoopCycle(page, 8);
  await page.evaluate(
    ([attribute, proof]) => {
      document
        .querySelector('[data-slot="toolcraft-runtime-app"]')!
        .setAttribute(attribute as string, proof as string);
    },
    [LOOP_PROOF_ATTRIBUTE, JSON.stringify({ initial, resized })] as const,
  );
  await expectToolcraftTimelineLoop(
    session.observe((root) =>
      JSON.parse(root.getAttribute("data-croix10-loop-proof") ?? "null"),
    ),
    { requirementId: "timeline.playback" },
  );
});
