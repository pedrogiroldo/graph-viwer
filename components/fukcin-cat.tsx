"use client";

import { startFaviconAnimation } from "@/lib/mouth-fuckin-cat";

export function FuckinCat() {
  const controller = startFaviconAnimation({
    frames: ["/cat1.jpg", "/cat2.jpg"],
    intervalMs: 200,
    takeoverExistingIcons: true, // remove temporariamente os favicons existentes para garantir prioridade
    pauseWhenHidden: true, // pausa quando a aba não está visível
  });

  return null;
}
