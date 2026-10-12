import { ChevronUp } from "lucide-react";
import { type PlaceViewModel, type StayViewModel } from "@/api/spaces";
import { formatClock, useSecondTick } from "@/lib/clock";
import { useDockSheet } from "@/lib/dock-sheet";
import { useLocalized, useT } from "@/lib/i18n";
import { hasOptions, PlaceIcon } from "@/lib/places";
import { Odometer } from "@/components/ninja/odometer";

/**
 * The room the customer is in, leading the Book tab: its own card made the
 * hero, on the slab with its kind drawn big behind it, the clock running
 * large under its name beside a live green dot, and the way into the room
 * (the same sheet as the dock's row opens). The places after it are there
 * to read: while the clock runs another cannot be booked.
 */
export function YourRoomCard({
  stay,
  place,
}: {
  stay: StayViewModel;
  place: PlaceViewModel;
}) {
  const t = useT();
  const localized = useLocalized();
  const now = useSecondTick();
  const open = useDockSheet((s) => s.setOpen);
  const since = stay.startedAt ? new Date(stay.startedAt).getTime() : now;

  return (
    <button
      type="button"
      onClick={() => open(true)}
      className="slab relative isolate flex min-h-44 w-full flex-col gap-4 overflow-hidden rounded-[1.75rem] p-5 text-start shadow-(--slab-shadow) transition-transform active:scale-[0.98] motion-reduce:transform-none"
    >
      <PlaceIcon
        kind={Number(place.kind)}
        className="pointer-events-none absolute -end-6 -bottom-8 -z-10 size-44 -rotate-12 opacity-[0.12]"
      />

      <span className="flex w-full items-center justify-between gap-3">
        {/* Running now: the live dot and the words for it */}
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-caption font-bold text-emerald-300">
          <span className="relative grid size-1.5 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
            <span className="size-1.5 rounded-full bg-emerald-400" />
          </span>
          {t("bookClockRunning")}
        </span>
        {/* The way in, worded as the dock's row is */}
        <span className="bg-background/12 flex h-9 shrink-0 items-center gap-1 rounded-full ps-3.5 pe-2.5 text-note font-semibold">
          {t("ninjaRoomOpen")}
          <ChevronUp className="size-4" />
        </span>
      </span>

      <span className="flex flex-col gap-1">
        <span className="heading text-title w-fit break-words">
          {localized(place.name)}
        </span>
        {/* A clock reads hours first in either language */}
        <span
          dir="ltr"
          className="self-start text-[2.5rem] leading-tight font-extrabold tracking-tight rtl:self-end"
        >
          <Odometer value={formatClock((now - since) / 1000)} />
        </span>
        {hasOptions(stay.tariff) && stay.currentOptionName && (
          <span className="bg-background/12 mt-1.5 w-fit rounded-full px-2.5 py-1 text-caption font-semibold">
            {localized(stay.currentOptionName)}
          </span>
        )}
      </span>
    </button>
  );
}
