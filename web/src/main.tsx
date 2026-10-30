// UI generated with Lovable on 30 Oct 2026, moved from its TanStack Start route to this plain Vite entry.
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { isLite } from "./lite";
import { ParallaxProvider, useParallax } from "@/lib/parallax-store";
import { Footer, ParallaxMark } from "@/components/parallax/shared";
import { HeardScreen, IntakeScreen, StartScreen } from "@/components/parallax/StartScreens";
import { GeneratingScreen, ProfileScreen } from "@/components/parallax/ProfileScreens";
import { AssumptionsPanel, PathsScreen } from "@/components/parallax/PathScreens";
import { ChatScreen } from "@/components/parallax/ChatScreen";
import { ComfortScreen, CompareScreen, SummaryScreen } from "@/components/parallax/DecideScreens";

function useEnvironment() {
  useEffect(() => {
    const lite = isLite(navigator, matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (lite) document.documentElement.setAttribute("data-lite", "");
    if (lite || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = document.documentElement.style;
        s.setProperty("--px", String(e.clientX / innerWidth - 0.5));
        s.setProperty("--py", String(e.clientY / innerHeight - 0.5));
      });
    };
    addEventListener("pointermove", onMove);
    return () => removeEventListener("pointermove", onMove);
  }, []);
}

function Shell() {
  const { step, active, paths, reset } = useParallax();
  useEnvironment();
  const Screen = {
    start: StartScreen, intake: IntakeScreen, heard: HeardScreen, generating: GeneratingScreen, profile: ProfileScreen,
    paths: PathsScreen, chat: ChatScreen, compare: CompareScreen, comfort: ComfortScreen, summary: SummaryScreen,
  }[step];
  return (
    <div data-path={active} className={`relative flex min-h-screen flex-col ${step === "chat" ? "path-tint" : ""}`}>
      <div className="ambient" aria-hidden="true">
        <div className="ambient__blob ambient__blob--1" />
        <div className="ambient__blob ambient__blob--2" />
        <div className="ambient__grain" />
      </div>
      {step !== "start" && (
        <div className="relative z-10 mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pt-4 no-print">
          <button type="button" onClick={reset} className="tap flex items-center gap-2 rounded-lg font-semibold" aria-label="Parallax, start over">
            <ParallaxMark size={28} /> Parallax
          </button>
        </div>
      )}
      <main key={step} className="relative z-10 w-full flex-1 px-4 py-6">
        <Screen />
      </main>
      {paths.length > 0 && <AssumptionsPanel />}
      <Footer />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ParallaxProvider>
      <Shell />
    </ParallaxProvider>
  </StrictMode>,
);
