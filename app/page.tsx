"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [phase, setPhase] = useState<"loading" | "gate" | "home">("loading");
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhase("gate");
    }, 2200);

    return () => window.clearTimeout(timer);
  }, []);

  const enterWorld = () => {
    if (bgMusicRef.current) {
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.play().catch(() => {
        // Ignore autoplay restrictions/errors
      });
    }
    setPhase("home");
  };

  return (
    <main className="min-h-screen bg-[#1a237e] text-white relative overflow-hidden" style={{ fontFamily: "var(--font-pixel), monospace" }}>
      <audio ref={bgMusicRef} src="/sound/ikkudi.mp3" loop preload="auto" />
      <div className="absolute inset-0 bg-linear-to-b from-[#4fc3f7] via-[#42a5f5] to-[#1e3a8a]" />
      <div className="absolute inset-0 opacity-25 bg-[url('/cloud_pixel.png')] bg-repeat bg-size-[220px_132px]" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-[#2e7d32] border-t-4 border-[#81c784]" />

      {phase === "loading" && (
        <section className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl border-4 border-black bg-[#fff8dc] text-[#1b1b1b] rounded-none p-8 md:p-10 shadow-[10px_10px_0_0_#000] text-center">
            <p className="text-[11px] mb-6">LOADING WORLD...</p>
            <div className="flex items-center justify-center gap-2">
              <span className="h-3 w-3 bg-[#0d47a1] animate-pulse" />
              <span className="h-3 w-3 bg-[#0d47a1] animate-pulse [animation-delay:180ms]" />
              <span className="h-3 w-3 bg-[#0d47a1] animate-pulse [animation-delay:360ms]" />
            </div>
          </div>
        </section>
      )}

      {phase === "gate" && (
        <section className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl border-4 border-black bg-[#fff8dc] text-[#1b1b1b] rounded-none p-8 md:p-10 shadow-[10px_10px_0_0_#000] text-center">
            <p className="text-[11px] mb-7">READY?</p>
            <button
              onClick={enterWorld}
              className="px-7 py-4 border-4 border-black bg-[#ffca28] text-black hover:bg-[#ffd54f] transition-colors shadow-[6px_6px_0_0_#000] text-[11px]"
            >
              ENTER THE WORLD
            </button>
          </div>
        </section>
      )}

      {phase === "home" && (
        <section className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-4xl border-4 border-black bg-[#fff8dc] text-[#1b1b1b] rounded-none p-8 md:p-12 shadow-[10px_10px_0_0_#000]">
            <p className="text-[10px] tracking-[0.22em] text-[#d84315] mb-4">NINTENDO STYLE PIXEL ADVENTURE</p>
            <h1 className="text-4xl md:text-6xl mb-5 leading-tight text-[#0d47a1]">IK KUDI</h1>
            <p className="text-[11px] md:text-xs max-w-3xl leading-7 mb-10 text-[#2e2e2e]">
              Ride forward, jump over danger, and keep the journey alive. The road is endless,
              the sky shifts from day to night, and your story keeps unfolding with every meter.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/game"
                className="px-7 py-4 border-4 border-black bg-[#ffca28] text-black hover:bg-[#ffd54f] transition-colors shadow-[6px_6px_0_0_#000] text-[11px]"
              >
                PRESS START
              </Link>
              <span className="px-4 py-3 border-4 border-black bg-white text-[10px]">
                SPACE = JUMP
              </span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
