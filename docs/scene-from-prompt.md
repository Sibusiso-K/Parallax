# Scene from the founder's prompt

Founders aren't all in food, and their stories won't all be the demo story. This page explains how Parallax builds
the founder's world from their own words, using Meta's models. It covers what ships today, the backend it runs on,
and how the 3D room can go further.

## What ships today

When Muse Spark has read the founder's own story (intake `mode: "model"`), the generating screen calls `startWorld()`
in the store. That makes one background request to `POST /api/scene`, which makes two Meta calls.

1. **Muse Spark dresses the room** (`shared/scene/dressing.ts`). The courtyard has five places and five objects, and
   each one has a job in the decision. Muse Spark names each one for this business and writes a one-line caption for
   it. It also names the setting, and writes one sentence describing where the founder stands.

   | Slot | Its job | Demo label | A logistics founder got |
   | --- | --- | --- | --- |
   | `spawn` | the business at a glance | Courtyard | Pretoria Depot Overview |
   | `offer` | the decision on the table | Offer | Contract Offer Table |
   | `intake` | the confirmed figures, beside the equipment | Intake | Depot Cost Corner |
   | `bridge` | the gap between doing the work and being paid | Bridge | Payment Wait Gap |
   | `memo` | where the memo is written | Memo | Decision Writing Desk |
   | `pan` | the direct cost of the extra work | Ingredients and packaging | (fuel, tyres, tolls) |
   | `fridge` | the equipment to buy or rent | Second fridge | (the two new trucks) |

2. **Muse Image draws the founder** (`shared/providers/image.ts`). It works from the setting sentence ("a truck
   depot at dawn, delivery trucks behind"). The person is kept generic: no real person, nothing guessed from the
   story. The browser shrinks the result to a 320 px JPEG, about 25 KB, so it can be saved with the decision. It is
   then shown for all three paths, the same way the demo shows one chef.

Measured live on 4 Nov:
- intake: about 13 s
- scene and portrait: about 12 s more, in the background, while the founder reads the profile

**The model never touches geometry or figures.** Labels are capped by a zod schema. `applyDressing()` changes only
labels, so positions, colliders, lighting and claims stay exactly as built. A missing or failed dressing leaves the
built room unchanged. With no model connected, `/api/scene` answers `mode: "fixture"` and the demo courtyard and
portraits stay.

## The contract

`POST /api/scene` with:

```json
{ "context": { "business": "Logistics company", "location": "Pretoria", "decision": "Take on a two-year retail delivery contract", "decisionType": "contract", "story": "..." } }
```

It answers:

```json
{
  "ok": true,
  "mode": "model",
  "dressing": {
    "title": "The Pretoria Depot",
    "places": { "spawn": { "label": "...", "caption": "..." }, "offer": {}, "intake": {}, "bridge": {}, "memo": {} },
    "objects": { "contract": { "label": "...", "caption": "..." }, "pan": {}, "fridge": {}, "intake_desk": {}, "memo": {} },
    "portrait": "A truck depot at dawn ..."
  },
  "portrait": "data:image/webp;base64,...",
  "models": { "scene": "muse-spark-1.3", "portrait": "muse-image-1.0" }
}
```

Each place and object entry above, shown as `{}`, has the same `label` and `caption` fields as the first one.

`portrait` is `null` when the image failed; the dressing still comes back.

## Hooks in the room (`web/src/immersive/World.tsx`)

- `ExploreBinding.dressing`: the store's `scene`, passed in by `ExploreScreen.tsx`.
- When the manifest loads, it is relabelled with `applyDressing(manifest, dressing)`. It is relabelled again if the
  dressing arrives later.
- The place card's title uses `dressing.title`.
- A selected object shows its caption above its own panel.

New pop-up tabs can read `binding.dressing.places[id].caption` and `binding.dressing.objects[id].caption` directly.

## Going further: a room built from the prompt

Each step below keeps the same rule: the model proposes, and code checks before anything reaches the room.

1. **Pick a room, not just labels.** Build two or three more CC0 rooms with the same five slots, in the way
   `assets/blender/build_courtyard.py` builds the courtyard: say a depot, a shopfront and a studio. Add a
   `setting: "courtyard" | "depot" | "shopfront" | "studio"` enum to `sceneDressing`, and Muse Spark picks the
   closest one. The manifest schema already validates any room with those slot ids.
2. **Backdrop from Muse Image.** Ask for a wide image of the setting (for example `size: "1792x1024"`) and use it
   in place of `joburg_bg.jpg` behind the fixed geometry.
3. **Props from images.** Muse Image draws a prop, such as a delivery van. SAM 3.1 cuts it out of its background.
   The cut-out then becomes a textured card at the slot's `position`. The prop changes only how the slot looks, never
   what it does.
4. **Check before showing.** Run every generated asset through the same gate the manifest uses: zod for the shape,
   size limits for images, and a fixed list of slots it may fill. Keep provenance beside it, in the spirit of
   `assets/provenance.json`, with the model, the prompt hash and the time.

Muse Wonder is also on the hackathon's model list. Before planning around it, check what it can do for 3D scenes
against Meta's documentation. Nothing here depends on it.
