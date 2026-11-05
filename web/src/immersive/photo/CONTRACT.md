# Worker A photo integration contract

The bake currently emits `web/public/worlds/photo-demo/manifest.json`. Canonical schema is Worker C's `shared/world/manifest.ts`, imported by `photo/manifest.ts`. Rectangles in the public contract are normalized `{x,y,width,height}`; the renderer adapts them internally to tuples. Person images and masks are transparent full-frame WebP. Patches are tightly cropped WebP with full-plate placement rectangles. Assets use local absolute URLs or inline image data as allowed by the shared schema; never embed keys.

PhotoWorld props: `readout: RoomReadout`, `place: PlaceId`, `selected: ObjectId|null`, `onSelect(id)`, `reduced: boolean`, `transcript: string|null`, `resetKey: string`, `disabled?: boolean`, `manifest?: PhotoManifest`, `base?: string`. Passing a validated live manifest/base replaces the baked demo. Caller owns object names and financial readout. Baked images must be labelled demo imagery for other founders.

Art direction: `[path / Photo Walk VR]` above a full photograph, person in its centre, paper readings on the actual desk/board; `[places / month]` below. Lusion's continuous spatial focus, Apple's single highlighted object and Linear's calm controls are the supplied references, not fresh browser research. Instrument Serif carries narration; existing Geist carries controls. No browser or dev server was launched, per the plan.

The plan explicitly assigns A the optional `persona: future-self` change in `shared/scene/advisor-model.ts`. It is implemented there; `photo/advisor.ts` sends it, and World selects that transport in Photo mode. Sentence checks and client ClaimRef verification remain unchanged. No new paid route was added. Offline answers remain labelled authored fixtures.
