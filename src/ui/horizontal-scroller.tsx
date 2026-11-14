"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./lib/utils";
import { Button } from "./primitives/button";

export function HorizontalScroller({
  label,
  children,
  controls = false,
  toolbar,
  className,
}: {
  label: string;
  children: ReactNode;
  controls?: boolean;
  toolbar?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft < 2;
      const end =
        element.scrollWidth - element.clientWidth - element.scrollLeft < 2;
      setEdges((previous) =>
        previous.start === start && previous.end === end
          ? previous
          : { start, end },
      );
    };
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      const max = element.scrollWidth - element.clientWidth;
      const direction = Math.sign(event.deltaY);
      if (
        max <= 0 ||
        (direction < 0
          ? element.scrollLeft <= 1
          : element.scrollLeft >= max - 1)
      )
        return;
      const amount =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientWidth
            : 1);
      event.preventDefault();
      element.scrollLeft = Math.max(
        0,
        Math.min(max, element.scrollLeft + amount),
      );
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    element.addEventListener("wheel", wheel, { passive: false });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    if (content.current) observer?.observe(content.current);
    return () => {
      element.removeEventListener("scroll", update);
      element.removeEventListener("wheel", wheel);
      observer?.disconnect();
    };
  }, []);

  function scroll(direction: number) {
    const element = viewport.current;
    if (!element) return;
    const item = content.current?.firstElementChild;
    const gap = content.current
      ? Number.parseFloat(getComputedStyle(content.current).columnGap) || 0
      : 0;
    const width = item
      ? item.getBoundingClientRect().width + gap
      : element.clientWidth;
    element.scrollBy({
      left: direction * width,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <div className="min-w-0 space-y-2">
      {(toolbar || controls) && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {controls && (
            <div className="hidden items-center gap-1 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-controls={id}
                aria-label="Scroll left"
                disabled={edges.start}
                onClick={() => scroll(-1)}
              >
                <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-controls={id}
                aria-label="Scroll right"
                disabled={edges.end}
                onClick={() => scroll(1)}
              >
                <ChevronRight aria-hidden="true" strokeWidth={1.5} />
              </Button>
            </div>
          )}
        </div>
      )}
      <div
        id={id}
        ref={viewport}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="snap-x snap-mandatory overflow-x-auto rounded-md p-0.5 [scrollbar-width:none] outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
          )
            return;
          event.preventDefault();
          scroll(event.key === "ArrowLeft" ? -1 : 1);
        }}
      >
        <div
          ref={content}
          className={cn(
            "flex w-max min-w-full gap-4 [&>*]:shrink-0 [&>*]:snap-start",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
