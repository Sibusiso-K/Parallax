// The roadmap: the decision at the top, the questions the app asked branching off it, and the three futures breaking out
// below, each with what can happen to it and the conversations held with it. Opening any part goes to that part of the app.
import { useMemo, type CSSProperties } from "react";
import { FIELD_LABELS, FIELD_QUESTIONS } from "@/lib/parallax-api";
import { useParallax, type Letter } from "@/lib/parallax-store";
import { buildRoadmap, type RoadmapNode, type RoadmapQuestion } from "@/lib/roadmap";
import { pathFigures, type Figures } from "@/lib/stress";
import { Badge, NoPaths, PATH_COLOR, cx } from "./shared";
import { StepNav } from "./StepNav";

function Item({ node, onOpen }: { node: RoadmapNode; onOpen: (node: RoadmapNode) => void }) {
  const body = (
    <>
      <b>{node.title}</b>
      {node.detail && <span>{node.detail}</span>}
    </>
  );
  return node.target ? (
    <button type="button" className="rm-item" onClick={() => onOpen(node)}>
      {body}
    </button>
  ) : (
    <div className="rm-item">{body}</div>
  );
}

export function RoadmapScreen() {
  const { paths, fields, chats, followed, assumed, set, go } = useParallax();
  const decision = typeof fields.decision === "string" ? fields.decision : "";
  const business = typeof fields.business === "string" ? fields.business : "";

  const figures = useMemo(() => {
    const out: Partial<Record<Letter, Figures>> = {};
    for (const p of paths) out[p.letter] = pathFigures(p);
    return out;
  }, [paths]);

  // The questions the app asked: the ones answered, and the ones answered "I don't know".
  const questions = useMemo<RoadmapQuestion[]>(
    () => [
      ...followed.map((key) => ({ key, question: FIELD_QUESTIONS[key] ?? FIELD_LABELS[key], answered: true })),
      ...assumed.map((key) => ({ key, question: FIELD_QUESTIONS[key] ?? FIELD_LABELS[key], answered: false })),
    ],
    [followed, assumed],
  );

  const roadmap = useMemo(
    () => buildRoadmap({ decision, business, paths, figures, chats, questions }),
    [decision, business, paths, figures, chats, questions],
  );

  if (paths.length === 0) return <NoPaths />;

  const open = (node: RoadmapNode) => {
    if (!node.target) return;
    if (node.target.letter) set({ active: node.target.letter });
    go(node.target.step);
  };

  return (
    <section className="screen roadmap" aria-labelledby="roadmap-title">
      <div className="pagehead">
        <div className="eyebrow">Your roadmap</div>
        <h1 id="roadmap-title">Every future, and every question on the way</h1>
        <div className="sub">
          Start from the decision. The questions the app asked branch off it, and each future breaks out below, with what can happen to it
          and the conversations you have had with it. Open any branch to go there.
        </div>
      </div>

      <div className="rm-root">
        <div className="rm-dot" aria-hidden="true" />
        <div className="rm-rootbody">
          <div className="caps">Your decision</div>
          <h2>{roadmap.root.title}</h2>
          {roadmap.root.detail && <p className="sub">{roadmap.root.detail}</p>}
        </div>
        {roadmap.root.children.length > 0 && (
          <ol className="rm-questions" aria-label="Questions the app asked">
            {roadmap.root.children.map((q) => (
              <li key={q.id}>
                <Item node={q} onOpen={open} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rm-split">
        {roadmap.branches.map((b) => (
          <section
            key={b.id}
            className="rm-branch"
            style={{ "--c": PATH_COLOR[b.letter!] } as CSSProperties}
            aria-labelledby={`${b.id}-title`}
          >
            <button type="button" className="rm-head" id={`${b.id}-title`} onClick={() => open(b)}>
              <Badge letter={b.letter!} />
              <span>
                <b>{b.title.replace(/^[A-C] · /, "")}</b>
                {b.detail && <span className="rm-hsub">{b.detail}</span>}
              </span>
            </button>
            <ol className="rm-list">
              {b.children.map((c) => (
                <li key={c.id} className={cx("rm-node", c.kind, c.warn && "warn")}>
                  <Item node={c} onOpen={open} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <StepNav />
    </section>
  );
}
