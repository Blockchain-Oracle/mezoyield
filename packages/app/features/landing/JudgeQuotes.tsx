import { Quote } from "lucide-react";

/**
 * Editorial pull-quotes from the Mezo Hack workshop transcripts. These
 * are the two on-camera moments that named the gap MezoYield fills —
 * Andre Coutinho (Supernormal Foundation, judge-adjacent) and Dimmitri
 * Paremski (Mezo integration eng). Treating them as oversized pull
 * quotes signals "we listened to you literally."
 *
 * Layout: two cards in a 2-col grid on lg+, stacked on mobile.
 * Asymmetric — left card is offset down ~24px to break the perfect
 * grid. Hand-set font-display sizes for editorial weight.
 */

const QUOTES = [
  {
    body: "We currently don't have anything that is like a simple way of getting yield on mezo token today.",
    author: "Andre Coutinho",
    role: "Supernormal Foundation",
    transcript: "Workshop transcript 7",
    accent: "right" as const,
  },
  {
    body: "Users don't need to remember about voting every single week. If you don't vote, you don't receive rewards.",
    author: "Dimmitri Paremski",
    role: "Mezo integration engineer",
    transcript: "Workshop transcript 3",
    accent: "left" as const,
  },
];

export function JudgeQuotes() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
      <div className="mb-12 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mezo">
          Why we built this
        </p>
        <h2 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          Two judges said this was missing.
          <br />
          <span className="italic text-mezo">We shipped it.</span>
        </h2>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          From the live Mezo Hack workshops. Both quotes name the exact gap
          MezoYield fills — automated MEZO yield with no weekly chore.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {QUOTES.map((q, i) => (
          <figure
            key={q.author}
            className={`relative rounded-2xl border border-border bg-card/40 p-8 backdrop-blur transition-colors hover:border-mezo/40 sm:p-10 ${
              i === 1 ? "lg:translate-y-6" : ""
            }`}
          >
            <Quote
              aria-hidden
              className={`absolute h-8 w-8 text-mezo ${
                q.accent === "left"
                  ? "left-6 top-6"
                  : "right-6 top-6 scale-x-[-1]"
              }`}
            />

            <blockquote className="mt-12 font-display text-2xl font-normal leading-[1.3] tracking-tight text-foreground sm:text-3xl">
              <span className="italic">&ldquo;</span>
              {q.body}
              <span className="italic">&rdquo;</span>
            </blockquote>

            <figcaption className="mt-8 flex items-center gap-3 border-t border-border pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-mezo/30 bg-mezo-soft font-display text-sm font-medium text-mezo">
                {initials(q.author)}
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {q.author}
                </span>
                <span className="text-xs text-muted-foreground">
                  {q.role} · {q.transcript}
                </span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
