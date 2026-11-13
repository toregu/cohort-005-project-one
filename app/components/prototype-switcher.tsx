// PROTOTYPE tool — floating bar that cycles ?variant= between UI variants.
// Hidden in production builds.

import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({
  variants,
}: {
  variants: { key: string; name: string }[];
}) {
  const [params, setParams] = useSearchParams();
  const current = params.get("variant") ?? variants[0].key;
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  function go(step: number) {
    const next = variants[(index + step + variants.length) % variants.length];
    setParams(
      (p) => {
        p.set("variant", next.key);
        return p;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  // Keep the chosen variant when sidebar links drop ?variant=.
  const fromUrl = params.get("variant");
  useEffect(() => {
    try {
      if (fromUrl) sessionStorage.setItem("prototype-variant", fromUrl);
      else {
        const saved = sessionStorage.getItem("prototype-variant");
        if (saved) setParams((p) => { p.set("variant", saved); return p; }, { replace: true, preventScrollReset: true });
      }
    } catch {}
  }, [fromUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 px-2 py-1 text-sm font-medium text-white shadow-lg">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Previous variant">
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2">
        {variants[index].key} ({variants[index].name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Next variant">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
