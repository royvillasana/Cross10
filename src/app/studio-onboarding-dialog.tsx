"use client";

import * as React from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/toolcraft/ui/components/composites";
import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import styles from "./studio-onboarding-dialog.module.css";
import {
  findStudioOutputShape,
  planStudioOnboardingChoice,
  planStudioOnboardingConfirmation,
  planStudioOnboardingDismissal,
  readStudioOnboardingChoice,
  readStudioOnboardingStep,
  shouldStudioOnboardingOpen,
  STUDIO_ONBOARDING_APPLY,
  STUDIO_ONBOARDING_BLANK,
  STUDIO_ONBOARDING_CARDS,
  STUDIO_ONBOARDING_CHOICE_TARGET,
  STUDIO_ONBOARDING_CHOOSING,
  STUDIO_ONBOARDING_CLOSED,
  STUDIO_ONBOARDING_REFERENCE,
  STUDIO_ONBOARDING_REPLACING,
  STUDIO_ONBOARDING_SETTLED_TARGET,
  STUDIO_ONBOARDING_SIZING,
  planStudioOnboardingReplacement,
  planStudioOnboardingStep,
  STUDIO_OUTPUT_SHAPES,
} from "./studio-onboarding";
import {
  planStudioStackRestoration,
  readStudioLayerRecord,
  readStudioStackSnapshot,
  studioApplicationLayerIds,
  studioApplyTargetFromSelection,
  STUDIO_LAYER_RECORD_TARGET,
  STUDIO_SNAPSHOT_TARGET,
} from "./studio-stack-state";
import {
  findStudioPreset,
  planStudioPresetApplication,
  studioPresetPickerLabel,
  STUDIO_PRESETS,
} from "./studio-presets";
import { STUDIO_TECHNIQUE_THUMBNAILS } from "./studio-technique-thumbnails";
import {
  STUDIO_REFERENCE_COMPARE_MODES,
  STUDIO_REFERENCE_STRENGTHS,
  STUDIO_REFERENCE_COMPARE_TARGET,
  STUDIO_REFERENCE_ENTRY_TARGET,
  STUDIO_REFERENCE_ITEMS,
  STUDIO_REFERENCE_OPACITY_TARGET,
} from "./studio-reference";

/**
 * The first thing a user meets, and the steps between opening the app and having
 * a canvas.
 *
 * **Rendered against a decision contract, on the product owner's instruction.**
 * The reasoning is kept in `studio-onboarding.ts`; in short, no listed extension
 * point may present a modal, upstream issue 14 asks for one, and the owner asked
 * for this flow anyway. What is *not* done is modifying the framework:
 * `src/toolcraft/**` stays signed and the integrity gate stays green, because a
 * contract judgement can be revisited and a tampered dependency cannot.
 *
 * The runtime's own `Dialog` composite is used rather than a hand-rolled one —
 * the product boundary permits importing it, asserted in
 * `studio-dialog-boundary.test.ts` — so the surface inherits the shell's focus
 * trapping, escape handling, backdrop and theme rather than approximating them.
 * It also portals out of the shell, which is what lets it be full-screen on a
 * phone: the shell carries `minWidth: 1024` with `overflow-hidden`, and anything
 * rendered inside it is clipped to a 1024px box the screen may only show part of.
 */
export function StudioOnboardingDialog(): React.JSX.Element | null {
  const dispatch = useToolcraftDispatch();
  const state = useToolcraftSelector((current) => current);
  const values = state.values as Readonly<Record<string, unknown>>;

  const step = readStudioOnboardingStep(values["stack.onboardingStep"]);
  const choice = readStudioOnboardingChoice(values[STUDIO_ONBOARDING_CHOICE_TARGET]);
  const layers = state.layers ?? [];
  // The stack the last replacement overwrote, if one is held. Read here rather
  // than asked for at press time so the offer can render only when there is
  // something to take back.
  const snapshot = readStudioStackSnapshot(values[STUDIO_SNAPSHOT_TARGET]);
  const selectedLayerId = state.selectedLayerId ?? null;

  const [shapeValue, setShapeValue] = React.useState("square");
  const [background, setBackground] = React.useState("#000000");

  /**
   * Where the dialog is portalled, and why it is named rather than defaulted.
   *
   * The composite portals to `document.body` when no container is given, and a
   * portal outside React's root container never receives React's delegated
   * events — the listeners live on the root, and the event has nowhere to reach
   * them from. Every `onClick` below silently did nothing: Playwright reported a
   * successful click, the handler never ran, and a direct DOM `.click()` worked,
   * which is what finally separated "not hit" from "not wired".
   *
   * The shell root is inside React's tree, so events work, and it is above the
   * transformed wrapper the canvas sits in, so a `position: fixed` popup still
   * resolves against the viewport rather than against a transform — the same
   * trap the region handles already record.
   */
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(
    null,
  );

  React.useEffect(() => {
    setPortalContainer(
      document.querySelector<HTMLElement>('[data-slot="toolcraft-runtime-app"]'),
    );
  }, []);

  const run = React.useCallback(
    (commands: readonly Readonly<Record<string, unknown>>[]): void => {
      for (const command of commands) {
        dispatch(command as Parameters<typeof dispatch>[0]);
      }
    },
    [dispatch],
  );

  /**
   * Opened on arrival when there is nothing to come back to.
   *
   * Keyed off an empty stack rather than a "seen it" marker, so a returning
   * author lands on their composition and someone staring at an empty canvas is
   * someone who has not started yet.
   */
  React.useEffect(() => {
    if (
      !shouldStudioOnboardingOpen({
        layerCount: layers.length,
        settled: values[STUDIO_ONBOARDING_SETTLED_TARGET] === true,
        step,
      })
    ) {
      return;
    }
    dispatch({
      history: "skip",
      target: "stack.onboardingStep",
      type: "controls.setValue",
      value: STUDIO_ONBOARDING_CHOOSING,
    } as Parameters<typeof dispatch>[0]);
  }, [dispatch, layers.length, step, values]);

  /** Leaves the flow without deciding anything. */
  const close = (): void => {
    run(planStudioOnboardingDismissal());
  };

  /**
   * Lays the chosen entry onto the selection.
   *
   * The plan is the same one the panel press used, so moving the surface did
   * not move the meaning: one code path decides what applying a composition to
   * a selection does, and the dialog is a caller rather than a second
   * implementation of it.
   */
  const onApply = (): void => {
    const target = studioApplyTargetFromSelection({ layers, selectedLayerId });
    const preset = findStudioPreset(values["gallery.entry"]);
    if (!target || !preset) return;

    run(
      planStudioPresetApplication({
        layers,
        preset,
        record: readStudioLayerRecord(values[STUDIO_LAYER_RECORD_TARGET]),
        selectedLayerId,
        target,
        targetLayerIds: studioApplicationLayerIds({
          layers,
          selectedLayerId,
          target,
        }),
      }),
    );
  };

  if (step === STUDIO_ONBOARDING_CLOSED) return null;

  const chosen = STUDIO_ONBOARDING_CARDS.find((card) => card.value === choice);
  const shape = findStudioOutputShape(shapeValue);

  return (
    <Dialog
      onOpenChange={(open) => {
        // Dismissable, and dismissing leaves the product usable rather than
        // blocked. Someone who already knows what they want should not have to
        // answer an introduction first.
        if (!open) run(planStudioOnboardingDismissal());
      }}
      open
    >
      <DialogContent
        data-studio-onboarding={step}
        // The dialog is portalled inside the shell so React's delegated events
        // can reach it, which also puts it inside the canvas viewport's own
        // pointer handling. That handler captures the pointer on press, so
        // `pointerup` and `click` were being delivered to the canvas and never
        // returned to the button underneath the cursor: pointerdown landed on
        // the card, pointerup landed on `DIV.group/canvas`, and every handler in
        // here silently did nothing while Playwright reported a successful
        // click. Held here so a press inside the dialog stays inside it.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        portalContainer={portalContainer}
        showCloseButton
        size="2xl"
      >
        {step === STUDIO_ONBOARDING_CHOOSING ? (
          <>
            <DialogHeader>
              <DialogTitle>What are you making?</DialogTitle>
              <DialogDescription>
                Every one of these is a construction the studio can draw. Pick one
                to start from, or start from nothing and build it yourself.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className={styles.grid}>
                {STUDIO_ONBOARDING_CARDS.map((card) => (
                  <button
                    aria-label={card.label}
                    aria-pressed={card.value === choice}
                    className={styles.card}
                    data-studio-onboarding-card={card.value}
                    key={card.value}
                    onClick={() =>
                      run(
                        planStudioOnboardingChoice(card.value, {
                          hasWork: layers.length > 0,
                        }),
                      )
                    }
                    type="button"
                  >
                    {card.src ? (
                      <img alt="" className={styles.thumb} src={card.src} />
                    ) : (
                      <span className={`${styles.thumb} ${styles.blank}`}>+</span>
                    )}
                    <span className={styles.cardLabel}>{card.label}</span>
                  </button>
                ))}
              </div>
              {snapshot ? (
                /**
                 * Taking back the last replacement, in the surface that made it.
                 *
                 * This was a panel row until now, and the row said what it was
                 * doing there: restore was meant to move with everything else
                 * that decides something, and did not, because the snapshot was
                 * believed not to reach a selector inside the dialog. It does --
                 * the dialog reads the same whole state the canvas does, and the
                 * value is there. What the note recorded was a conclusion drawn
                 * from an instrumented run rather than a property of the
                 * runtime, and it outlived whatever made it true.
                 *
                 * Rendered only when a replacement is actually held, which is
                 * the reverse of what a panel row can do: a permanent row has to
                 * be present and inert most of the time, while an offer that
                 * appears exactly when it can be taken is an offer.
                 */
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    You replaced a stack with {snapshot.appliedLabel}
                  </span>
                  <button
                    className={styles.shape}
                    data-studio-onboarding-restore=""
                    onClick={() =>
                      run(
                        planStudioStackRestoration({
                          currentLayerIds: layers.map((layer) => layer.id),
                          snapshot,
                        }),
                      )
                    }
                    type="button"
                  >
                    Restore what was there
                  </button>
                </div>
              ) : null}
            </DialogBody>
          </>
        ) : step === STUDIO_ONBOARDING_REPLACING ? (
          <>
            <DialogHeader>
              <DialogTitle>This replaces what you have</DialogTitle>
              <DialogDescription>
                A technique is a whole construction, not a setting — starting{" "}
                {chosen?.label ?? "a new one"} means becoming that stack. Your
                current work goes. You can bring it back with Restore previous.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                className={styles.shape}
                data-studio-onboarding-keep=""
                onClick={() => run(planStudioOnboardingStep(STUDIO_ONBOARDING_CHOOSING))}
                type="button"
              >
                Keep my work
              </button>
              <button
                className={styles.shape}
                data-studio-onboarding-replace=""
                onClick={() =>
                  run(
                    planStudioOnboardingReplacement({
                      choice,
                      layers,
                      record: readStudioLayerRecord(values[STUDIO_LAYER_RECORD_TARGET]),
                      selectedLayerId: state.selectedLayerId ?? null,
                    }),
                  )
                }
                type="button"
              >
                Replace it
              </button>
            </DialogFooter>
          </>
        ) : step === STUDIO_ONBOARDING_APPLY ? (
          <>
            <DialogHeader>
              <DialogTitle>Apply a composition to the selection</DialogTitle>
              <DialogDescription>
                This lays a construction onto the layers you have selected. It
                adds to the work rather than replacing it — nothing is created,
                removed or reordered, and the rest of the stack is left alone.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className={styles.grid}>
                {STUDIO_PRESETS.map((preset) => (
                  <button
                    aria-label={studioPresetPickerLabel(preset)}
                    aria-pressed={preset.id === values["gallery.entry"]}
                    className={styles.card}
                    data-studio-onboarding-apply={preset.id}
                    key={preset.id}
                    onClick={() =>
                      run([
                        {
                          history: "skip",
                          target: "gallery.entry",
                          type: "controls.setValue",
                          value: preset.id,
                        },
                      ])
                    }
                    type="button"
                  >
                    <img
                      alt=""
                      className={styles.thumb}
                      src={STUDIO_TECHNIQUE_THUMBNAILS[preset.id] ?? ""}
                    />
                    <span className={styles.cardLabel}>
                      {studioPresetPickerLabel(preset)}
                    </span>
                  </button>
                ))}
              </div>
              <p className={styles.hint}>
                It lands on whatever the layers panel has highlighted — a layer,
                or a group and everything under it.
              </p>
            </DialogBody>
            <DialogFooter>
              <button
                className={styles.shape}
                data-studio-onboarding-apply-cancel=""
                onClick={close}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.shape}
                data-studio-onboarding-apply-confirm=""
                disabled={!values["gallery.entry"]}
                onClick={() => {
                  onApply();
                  close();
                }}
                type="button"
              >
                Apply it
              </button>
            </DialogFooter>
          </>
        ) : step === STUDIO_ONBOARDING_REFERENCE ? (
          <>
            <DialogHeader>
              <DialogTitle>What are you working against?</DialogTitle>
              <DialogDescription>
                A study sits behind the canvas so you can see how far off you
                are. It is never part of the work and never reaches an export.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className={styles.grid}>
                {STUDIO_REFERENCE_ITEMS.map((item) => (
                  <button
                    aria-label={item.alt}
                    aria-pressed={item.value === values[STUDIO_REFERENCE_ENTRY_TARGET]}
                    className={styles.card}
                    data-studio-onboarding-study={item.value}
                    key={item.value}
                    onClick={() =>
                      run([
                        {
                          history: "skip",
                          target: STUDIO_REFERENCE_ENTRY_TARGET,
                          type: "controls.setValue",
                          value: item.value,
                        },
                        // Shown at once, because a study nobody can see is a
                        // study nobody chose.
                        ...(Number(values[STUDIO_REFERENCE_OPACITY_TARGET] ?? 0) > 0
                          ? []
                          : [
                              {
                                target: STUDIO_REFERENCE_OPACITY_TARGET,
                                type: "controls.setValue",
                                value: 0.5,
                              },
                            ]),
                        ...planStudioOnboardingDismissal(),
                      ])
                    }
                    type="button"
                  >
                    <img alt="" className={styles.thumb} src={item.src} />
                    <span className={styles.cardLabel}>{item.alt}</span>
                  </button>
                ))}
              </div>

              {/*
                How the study is read, next to the choice of study.
                These were two sidebar controls until the product owner pointed
                out that a study is not something you keep adjusting beside the
                work -- you set it when you pick one and then get on with
                building. So they moved here, where the picture they describe is
                on screen to compare against.
              */}
              <div className={styles.field}>
                <span className={styles.fieldLabel}>How strongly it shows</span>
                {/*
                  Named strengths rather than a slider, for two reasons. The
                  integrity gate forbids product source recreating a built-in
                  control, and an `input type="range"` is exactly that. And a
                  slider would be the wrong control here anyway: this surface is
                  modal, so the work it is compared against is covered while the
                  value is being set, and a continuous scale you cannot see the
                  effect of is a scale nobody can use. Four stops you can pick
                  blind are honest about that.
                */}
                <div className={styles.shapes}>
                  {STUDIO_REFERENCE_STRENGTHS.map((strength) => (
                    <button
                      aria-label={strength.label}
                      aria-pressed={
                        Number(values[STUDIO_REFERENCE_OPACITY_TARGET] ?? 0) ===
                        strength.value
                      }
                      className={styles.shape}
                      key={strength.label}
                      onClick={() =>
                        run([
                          {
                            target: STUDIO_REFERENCE_OPACITY_TARGET,
                            type: "controls.setValue",
                            value: strength.value,
                          },
                        ])
                      }
                      type="button"
                    >
                      {strength.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>How it is compared</span>
                <div className={styles.shapes}>
                  {STUDIO_REFERENCE_COMPARE_MODES.map((mode) => (
                    <button
                      aria-label={mode.label}
                      aria-pressed={
                        mode.value === values[STUDIO_REFERENCE_COMPARE_TARGET]
                      }
                      className={styles.shape}
                      key={mode.value}
                      onClick={() =>
                        run([
                          {
                            target: STUDIO_REFERENCE_COMPARE_TARGET,
                            type: "controls.setValue",
                            value: mode.value,
                          },
                        ])
                      }
                      type="button"
                    >
                      {mode.label}
                      <span className={styles.shapeSize}>{mode.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </DialogBody>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>How big is it?</DialogTitle>
              <DialogDescription>
                {chosen && chosen.value !== STUDIO_ONBOARDING_BLANK
                  ? `Starting from ${chosen.label}.`
                  : "Starting from an empty canvas."}{" "}
                Sizing it now means nothing has to be reflowed later.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className={styles.shapes}>
                {STUDIO_OUTPUT_SHAPES.map((option) => (
                  <button
                    aria-label={option.label}
                    aria-pressed={option.value === shapeValue}
                    className={styles.shape}
                    data-studio-onboarding-shape={option.value}
                    key={option.value}
                    onClick={() => setShapeValue(option.value)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <span className={styles.shapeSize}>
                      {option.width} × {option.height}
                    </span>
                  </button>
                ))}
              </div>
              {/*
                * Two grounds, not a colour picker.
                *
                * A picker is a built-in and product code may not recreate one --
                * the integrity check catches `input type="color"` by name, and
                * it is right to: a hand-rolled picker would drift from the real
                * control that sits in Setup a moment later. What a starting step
                * genuinely needs is lighter or darker ground, which is a choice
                * between two things rather than a colour space. Anything else is
                * a change to make once the work is on screen.
                */}
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Ground</span>
                <div className={styles.shapes}>
                  {[
                    { label: "Dark", value: "#000000" },
                    { label: "Light", value: "#FFFFFF" },
                  ].map((option) => (
                    <button
                      aria-label={`${option.label} ground`}
                      aria-pressed={option.value === background}
                      className={styles.shape}
                      data-studio-onboarding-ground={option.label.toLowerCase()}
                      key={option.value}
                      onClick={() => setBackground(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.hint}>
                Every one of these stays editable afterwards — this is where the
                work starts, not what it is fixed to.
              </p>
            </DialogBody>
            <DialogFooter>
              <button
                className={styles.shape}
                onClick={() =>
                  run([
                    {
                      history: "skip",
                      target: "stack.onboardingStep",
                      type: "controls.setValue",
                      value: STUDIO_ONBOARDING_CHOOSING,
                    },
                  ])
                }
                type="button"
              >
                Back
              </button>
              <button
                className={styles.shape}
                data-studio-onboarding-confirm=""
                onClick={() =>
                  run(
                    planStudioOnboardingConfirmation({
                      background,
                      choice,
                      layers,
                      record: readStudioLayerRecord(values[STUDIO_LAYER_RECORD_TARGET]),
                      selectedLayerId: state.selectedLayerId ?? null,
                      shape,
                    }),
                  )
                }
                type="button"
              >
                {chosen && chosen.value !== STUDIO_ONBOARDING_BLANK
                  ? "Create something like that"
                  : "Start creating"}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
