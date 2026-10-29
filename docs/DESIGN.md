# Design: look, motion and feel

Written 29 Oct 2026 (day 4) for Lethabo's review. It sets the visual and motion direction for the screens in [SCOPE.md](SCOPE.md) §3 and [DEMO.md](DEMO.md) §7. It adds no features: every item styles a feature already in [FEATURES.md](FEATURES.md). Anything beyond readable and consistent is PLAN.md §5 cut 8, so none of it goes ahead of the working full flow.

## 1. Direction

**Futures stacked in depth.** Each path is a layer. Moving between paths means one future steps back and another comes forward. Calm and readable first; motion explains what happened, it never decorates.

## 2. Reference studied: robinpayot.com

Studied 29 Oct 2026 in two passes: a teardown of its HTML, CSS and script bundle, and a hands-on walkthrough on desktop and phone. We borrow ideas only, never its code, assets, fonts or copy.

| What makes it immersive | How the site does it | What we take |
|---|---|---|
| One world that never reloads | A single WebGL canvas; views are camera positions in one scene; a project panel becomes the project page | Screens never reload; the avatar carries from card to chat; Back returns to where you were |
| One metaphor everywhere | A road: loader, map, mini-map, signpost labels, highway-sign type; scrolling is driving | Layers in depth: logo, progress, cards, tabs, switching, summary |
| One motion language | One ease-out curve used about 90 times; most durations 0.5–2 s | One ease and three durations (§4), shorter than the site's |
| Colour with meaning | One colour per kind of work; the palette changes by zone | One colour per path, never meaning good or bad |
| Small constant life | The camera drifts toward the mouse; dust floats; things react on hover | Only an optional ambient background on desktop, after freeze |

**What it costs** (measured 29 Oct): Three.js r113, GSAP 3.6 and Howler in one bundle of about 340 KB gzipped before any content; about 1.2 MB before the Enter button and 2.5 MB of audio after it. Portrait phones are blocked and the site says it was built for desktop. No reduced-motion, keyboard, focus or ARIA support was found, and the URL never changes, so browser Back leaves the site.

**Lesson:** the immersion comes from design decisions (continuity, one metaphor, one motion language, meaningful colour), not from WebGL. Those decisions are cheap; the 3D is not.

## 3. Principles

1. **Trust before spectacle.** Figures are real, selectable text. They appear; they never count up, form out of particles or fly into place. Assumptions are one tap away, and "Not financial advice" and "One possible future, not a prediction" stay on screen (F1, SCOPE §6).
2. **One metaphor: layers in depth.** Used on every screen that shows more than one path.
3. **One world.** A single-page app; shared elements carry between screens; the browser's Back button moves between screens.
4. **Motion only for something that happened:** a path is ready, a switch, a new answer, a drawer opens. Nothing moves on its own except the optional ambient background (§9, row 6).
5. **Phone first.** Portrait at 360 px wide on a mid-range Android phone with costly data, and readable at 1080p for the video.
6. **Accessible by default** (§8).

## 4. Tokens

**Motion**

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.19, 1, .22, 1)` | Everything that enters or moves |
| `--dur-fast` | 150 ms | Hover, focus, chips; every transition in lite mode |
| `--dur-base` | 300 ms | Drawers, panels, list items |
| `--dur-slow` | 600 ms | The depth swap (§6), path colour change |
| `--stagger` | 40 ms | Between items revealed in sequence |

**Path colours.** One per path (A, B, C), for example blue, peach and violet; exact values are set with the scaffold. None may read as good or bad, so no red and no green. Always paired with the path's letter and name, and any text on them meets 4.5:1. Used on the path card, the avatar placeholder, a faint chat tint, the tab, the compare column and the summary.

**Lite mode.** `data-lite` on `<html>` when `prefers-reduced-motion: reduce` is set, or the browser reports Save-Data or 4 GB of memory or less. Lite mode drops the ambient background and blur, and every depth effect becomes a 150 ms crossfade.

## 5. Screen by screen

| Moment | Feature | Design | Effort |
|---|---|---|---|
| Start and consent | F1 | The Parallax mark is three offset layers. One Begin button that grows slightly on hover and focus. The notice in plain words, with a real choice. No loader show, no sound, no gate | S |
| Generation progress (DEMO §7 #2) | F6, F7, F9 | The "You, today" card stays on screen. Behind it, one layer per path draws itself (SVG stroke) and settles into its colour when that path's real progress event arrives, with the real step named ("Computing ranges in code"). No fake percentages or timers | ~2.5 h |
| Path cards (#3) | F6, F9 | Cards stacked in depth: back cards smaller, dimmer and inert; arrow keys or swipe bring the next forward; on phones, horizontal scroll-snap. The avatar starts as a silhouette in the path colour and sharpens from a blur over 500 ms once the image has decoded; its box is sized up front so nothing jumps. The initials badge fallback is unchanged | 4–5 h |
| Future-self chat (#5) | F10, F12 | The avatar moves into the chat header (shared-element transition) and the background takes a faint path tint. Otherwise an ordinary chat: 16 px text or larger, high contrast. Citation chips fade in when their sentence completes; the trace drawer slides in from the side | ~½ day |
| Switching and "Ask this on another path" (#6) | F13 | The depth swap (§6). Path tabs work as a mini-map: three small stacked layers with the current one forward. A chip shows "Asked on A, now on B" | ~½ day |
| Compare view (#7) | F14 | Path colours only, no motion of its own. It stays secondary and is never the landing screen | — |
| Comfort check and summary (#8, #9) | F15, F16 | The layers fan out side by side and the chosen one lifts slightly. "Not ready yet" gets equal weight | S–M, after freeze |

S is under two hours; M is about half a day.

## 6. Signature moment: the depth swap

Used for "Ask this on another path" and for switching tabs.

1. The question bubble lifts from the current chat.
2. The current layer moves back (smaller, dimmed to about 60%) over 600 ms.
3. The target layer comes forward to full size; its header shows that path's avatar.
4. The bubble lands as the first new message, and the new future self's reply streams in.

**How:** transform and opacity only. The same-document View Transitions API where the browser supports it; otherwise a CSS transition between two stacked layers; in lite mode a 150 ms crossfade. Focus moves to the new chat's input, and a live region announces the new path by letter and name. Each agent still sees only its own path (F13); the animation changes nothing about what the model receives.

**Why this one:** it is the demo's key moment (DEMO.md §2, 1:10–1:25) and on PLAN.md §5's never-cut list, so the effort is easy to defend. It acts out the name. It reads clearly at 1080p, and transform-and-opacity animation stays smooth on mid-range Android.

## 7. Not borrowing

| Not borrowing | Why |
|---|---|
| An Enter gate, a desktop-only note, a portrait lock | Our users are on phones in portrait |
| Ambient sound and sound effects | A serious tool, and data costs. If ever added: one opt-in sound, off by default |
| A full 3D scene, custom shaders, post-processing | Bundle size and battery on mid-range Android; the schedule. A single canvas gradient is after freeze at most |
| Text drawn in WebGL | Screen readers, zoom and translation cannot reach it |
| Endless looping scroll | You lose your place, and it does not suit forms or chat |
| Autoplay video, multi-megabyte images | Data costs |
| Magnetic or cursor-chasing buttons | Feels like a game; causes misclicks in forms |
| Numbers that count up or form from particles | Figures must look computed, not conjured (SCOPE §6, principle 2) |
| Analytics before consent; a banner without a real choice | POPIA and our own consent screen (RISKS.md §3, F1) |

## 8. Accessibility and weight

- Every control is a real button or link, reachable with Tab, with a visible 2 px focus ring. Escape closes drawers.
- Text contrast 4.5:1 or better, including inactive tabs and text on path colours.
- Figures are always text; decorative SVG and canvas are `aria-hidden`.
- Reduced motion turns on lite mode (§4).
- Targets, checked on day 8 with the latency work (PLAN.md §3): first screen under about 250 KB of gzipped JavaScript, with the charts loaded only when the compare view opens; system fonts or one woff2 file; avatars as WebP at display size.
- Tested at 360 × 800 portrait and at 1920 × 1080.

## 9. Build order

| Order | Item | Effort | When |
|---|---|---|---|
| 1 | Tokens: motion, path colours, lite mode (§4) | 2–3 h | With the scaffold |
| 2 | The depth swap (§6) | ~½ day | Before the freeze (F13 is never-cut) |
| 3 | Layered generation progress | ~2.5 h | Before the freeze |
| 4 | Stacked path cards and avatar blur-to-sharp | 4–5 h | Only if the full flow works by day 6 (cut 8) |
| 5 | Avatar-to-chat-header transition and path tint | ~½ day | Only if the full flow works by day 6 (cut 8) |
| 6 | Ambient gradient with grain (desktop only), word-by-word reveal on two headings, summary fan-out | — | After the freeze, only if both agree (PLAN.md §5) |

Rows 1–3 are about one day for one person, on top of building the screens themselves.

## 10. Open questions for Lethabo

1. Does the avatar style (F9) work with a silhouette placeholder in the path colour and a blur-to-sharp reveal?
2. Any objection to blue, peach and violet as path colours?
3. After a switch, should focus move to the new chat's input, or stay on the tabs?
