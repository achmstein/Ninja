import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { type LiveBills } from "@/lib/live-bills";
import { BillCard } from "./bill-card";

/**
 * The bills open now, each with its rounds standing open and the ones on
 * their way already on it: the dock's live bill sheet and the bills page
 * both show them so. One fills the width; two or more (a table and a room)
 * sit side by side and swipe, like the menu's categories.
 */
export function OpenBills({ live }: { live: LiveBills }) {
  return (
    <Swipe>
      {live.forming && (
        <BillCard
          key="forming"
          bill={live.forming.bill}
          pending={live.forming.rounds}
          ordersById={live.ordersById}
          takeover
        />
      )}
      {live.open.map(({ bill, pending }) => (
        <BillCard
          key={String(bill.id)}
          bill={bill}
          pending={pending}
          ordersById={live.ordersById}
          takeover
        />
      ))}
    </Swipe>
  );
}

/** Whether there is a bill to show: one open, or one forming out of rounds on their way */
export function hasLiveBill(live: LiveBills): boolean {
  return live.forming != null || live.open.length > 0;
}

/**
 * Two bills or more, one at a time: a finger swipes between them, and a line
 * over them says how many there are and which is in view (Bill 1 of 2), with
 * dots and steps to the one before and the next. The bill in view takes the
 * whole width; the others stay out of sight. The row is as tall as the bill
 * in view, not the tallest one (a long receipt printed out under the other
 * bill), and eases to the next one's height as it comes in.
 */
function Swipe({ children }: { children: ReactNode }) {
  const t = useT();
  const cards = Children.toArray(children).filter(Boolean);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | null>(null);
  const many = cards.length > 1;

  // The bill in view sets the row's height, following it as it grows (its stack fanning, its receipt printing)
  useEffect(() => {
    const card = track.current?.children[index] as HTMLElement | undefined;
    if (!many || !card) return;
    const watch = new ResizeObserver(() => setHeight(card.offsetHeight));
    watch.observe(card);
    return () => watch.disconnect();
  }, [index, many]);

  if (!many) return <>{cards}</>;

  const cardsIn = () =>
    Array.from(track.current?.children ?? []) as HTMLElement[];
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const middle = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0;
    let bestGap = Infinity;
    cardsIn().forEach((card, i) => {
      const box = card.getBoundingClientRect();
      const gap = Math.abs(box.left + box.width / 2 - middle);
      if (gap < bestGap) {
        best = i;
        bestGap = gap;
      }
    });
    setIndex(best);
  };
  const go = (to: number) =>
    cardsIn()[to]?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });

  return (
    <div>
      {/* Over the bill, so it is seen before a long receipt pushes anything under it out of sight */}
      <div className="mb-2.5 flex items-center gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1} / ${cards.length}`}
            aria-current={i === index || undefined}
            onClick={() => go(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "bg-foreground w-4" : "bg-foreground/25 w-1.5",
            )}
          />
        ))}
        <span className="text-muted-foreground ms-1 flex-1 text-xs font-semibold">
          {t("ninjaBillOf", { index: index + 1, count: cards.length })}
        </span>
        <StepButton
          side="start"
          label={t("ninjaBillPrev")}
          onClick={index > 0 ? () => go(index - 1) : undefined}
        />
        <StepButton
          side="end"
          label={t("ninjaBillNext")}
          onClick={index < cards.length - 1 ? () => go(index + 1) : undefined}
        />
      </div>
      {/* items-start: each bill keeps its own height, rather than stretching to the tallest; the row
          clips to the one in view, so a taller one beside it hangs out of sight, not as empty space */}
      <div
        ref={track}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory items-start gap-4 overflow-x-auto overflow-y-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={height != null ? { height } : undefined}
      >
        {cards.map((card, i) => (
          <div key={i} className="w-full shrink-0 snap-start snap-always">
            {card}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepButton({
  side,
  label,
  onClick,
}: {
  side: "start" | "end";
  label: string;
  onClick?: () => void;
}) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onClick}
      onClick={onClick}
      className="bg-foreground/8 grid size-8 place-items-center rounded-full transition-opacity disabled:opacity-30"
    >
      <Icon className="size-4 rtl:rotate-180" />
    </button>
  );
}
