// UI generated with Lovable on 30 Oct 2026; restyled on 2 Nov 2026 in the marketplace-style preview branch.
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ParallaxProvider, useParallax } from "@/lib/parallax-store";
import { Footer, ParallaxMark, cx } from "@/components/parallax/shared";
import { ControlRoom } from "@/components/parallax/Frame";
import { HeardScreen, IntakeScreen, StartScreen } from "@/components/parallax/StartScreens";
import { GeneratingScreen, ProfileScreen } from "@/components/parallax/ProfileScreens";
import { AssumptionsPanel, PathsScreen } from "@/components/parallax/PathScreens";
import { ChatScreen } from "@/components/parallax/ChatScreen";
import { CompareScreen, SummaryScreen } from "@/components/parallax/DecideScreens";

const SCREENS = {
  start: StartScreen,
  intake: IntakeScreen,
  heard: HeardScreen,
  generating: GeneratingScreen,
  profile: ProfileScreen,
  paths: PathsScreen,
  chat: ChatScreen,
  compare: CompareScreen,
  comfort: CompareScreen,
  summary: SummaryScreen,
} as const;

/** These screens come before the business is read, so they stand alone; the rest sit inside the Control Room frame. */
const STANDALONE = new Set(["start", "intake", "generating"]);

// The immersive 3D world loads only on ?world, as its own chunk, so the main app's first screen stays small.
const World = lazy(() => import("./immersive/World"));
const wantsWorld = new URLSearchParams(location.search).has("world");

function Shell() {
  const { step, paths, reset } = useParallax();
  const Screen = SCREENS[step];
  if (!STANDALONE.has(step)) {
    return (
      <>
        <ControlRoom>
          <Screen />
        </ControlRoom>
        {paths.length > 0 && <AssumptionsPanel />}
      </>
    );
  }
  return (
    <div className={cx("plain", step === "start" && "plain-start")}>
      {step !== "start" && (
        <header className="plain-head">
          <button type="button" className="brand" onClick={reset} aria-label="Parallax, start over">
            <ParallaxMark size={28} /> Parallax
          </button>
        </header>
      )}
      <main className="plain-main">
        <Screen />
      </main>
      <Footer />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {wantsWorld ? (
      <Suspense fallback={null}>
        <World />
      </Suspense>
    ) : (
      <ParallaxProvider>
        <Shell />
      </ParallaxProvider>
    )}
  </StrictMode>,
);
