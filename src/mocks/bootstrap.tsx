"use client";
import { useEffect } from "react";
import { startMocks } from "./browser";
export default function PreviewBootstrap({
  onStateChange,
}: {
  onStateChange: (state: { ready: boolean; failed: boolean }) => void;
}) {
  useEffect(() => {
    let active = true;
    void startMocks()
      .then(() => {
        if (active) onStateChange({ ready: true, failed: false });
      })
      .catch(() => {
        if (active) onStateChange({ ready: false, failed: true });
      });
    return () => {
      active = false;
    };
  }, [onStateChange]);
  return null;
}
