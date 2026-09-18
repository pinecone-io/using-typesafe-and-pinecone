---
name: record-demo-gif
description: Record or re-record the demo GIF for an example in this repo — driving the app with Playwright, capturing in real time, and assembling with ffmpeg. Use when asked to make, remake, update, or re-shoot a demo GIF or screen recording of an example, or after copy or UI changes have made the existing GIF stale.
---

# Recording a demo GIF

Each example owns a script at `src/scripts/record-demo.ts` that drives the app, records video, and
converts it to `docs/demo.gif`. Run it from the example directory with the dev server already up:

```bash
npm run record-demo
```

Requires `ffmpeg` on PATH. Knobs are environment variables, not edits:

| Variable      | Default                     | Use                                                        |
| ------------- | --------------------------- | ---------------------------------------------------------- |
| `DEMO_URL`    | `http://localhost:3000`     | Point at whatever port the dev server took                 |
| `DEMO_PRESET` | `Midwest and very colorful` | Any chip label, matched by text                            |
| `DEMO_STOP`   | `typesafe`                  | `claude` waits for the slow column, writes `demo-full.gif` |

## The rules that matter

**Capture in real time or the GIF lies.** The first version of this script screenshotted in a
loop, which decouples frame count from wall-clock: a 1.2s request produced ~95 frames, which at
12fps played back over 7 seconds. It made the fast thing look slow, which was the opposite of the
point. Playwright's `recordVideo` is real-time by construction — use it, and never reintroduce a
screenshot loop for anything whose duration is the message.

**Warm the server before recording.** A run started right after a file edit catches the dev
server's hot recompile and folds it into the timing — one take reported 11.7s where the real
number was 1.2s. Hit the page and the API once first, then record. If a number looks wrong, it
probably is; re-run before believing it.

**The click has to change something.** The app boots with a preset already selected. Recording a
click on _that_ preset shows nothing happening, because the fields already hold its values. Always
record a `DEMO_PRESET` different from the app's default first chip.

**Wait on a UI signal, not a timeout.** The script waits for the target column's `.badge-pending`
to detach, so it ends the moment that column resolves regardless of how long it took. Sleeping a
fixed duration instead either truncates a slow run or pads a fast one.

**Draw a cursor.** Playwright clicks leave no visual trace. The script injects a dot that moves and
pulses on click; without it the GIF looks like the UI is operating itself. It also sets
`caret-color: transparent` so no text cursor blinks in the recording.

## Check the output before shipping it

Extract frames and actually look at them:

```bash
ffmpeg -loglevel error -i docs/demo.gif -vsync 0 /tmp/gifcheck/g%03d.png
```

Confirm three beats are legible: the state before the click, the fields visibly changing after it,
and the finished result with its timing badge. A GIF that technically recorded but shows no visible
change is the most common failure.

## Size

Around 2MB for 7-8 seconds is normal and fine for GitHub. If it needs to be smaller, cut duration
first, then `OUT_WIDTH`, then colors. The palette settings are tuned for flat UI —
`palettegen=max_colors=128` with `paletteuse=dither=none` compresses a screen recording far better
than dithering, which adds noise that GIF cannot compress.

## When the app changes

The GIF goes stale on any visible change — copy, layout, colors, column titles. Re-record rather
than leaving a recording that shows text the app no longer says.

If the thing being demonstrated is one component's speed, that component has to render
independently of anything slower beside it. In `nli-reranking` the API streams NDJSON so each
column appears as its own result lands; before that, a fast reranker was invisible because the page
waited on a slow one to paint anything at all.
