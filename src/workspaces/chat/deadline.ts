"use client";
import { useEffect, useState } from "react";
export function remainingSeconds(
  startedAt: string | null,
  limit: number,
  now: number,
) {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  return Math.max(
    0,
    Math.min(limit, Math.ceil((start + limit * 1000 - now) / 1000)),
  );
}
export function useDeadline(startedAt: string | null, limit: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return remainingSeconds(startedAt, limit, now);
}
