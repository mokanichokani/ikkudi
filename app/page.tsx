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
    <main className="min-h-screen text-white relative overflow-hidden" style={{ fontFamily: "var(--font-pixel), monospace", backgroundColor: 'var(--rainbow-blue)' }}>
      <audio ref={bgMusicRef} src="/sound/ikkudi.mp3" loop preload="auto" />
      <div className="absolute inset-0 bg-linear-to-b from-[#4fc3f7] via-[#42a5f5] to-[#1e3a8a]" />
      <div className="absolute inset-0 opacity-25 bg-[url('/cloud_pixel.png')] bg-repeat bg-size-[220px_132px]" />
      <div className="absolute bottom-0 left-0 right-0 h-28 border-t-4 border-[#81c784]" style={{ backgroundColor: 'var(--rainbow-green)' }} />

      {phase === "loading" && (
        <section className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl border-4 border-black rounded-none p-8 md:p-10 shadow-[10px_10px_0_0_#000] text-center" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
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
          <div className="w-full max-w-xl border-4 border-black rounded-none p-8 md:p-10 shadow-[10px_10px_0_0_#000] text-center" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <p className="text-[11px] mb-7">READY?</p>
            <button
              onClick={enterWorld}
              className="px-7 py-4 border-4 border-black hover:opacity-90 transition-colors shadow-[6px_6px_0_0_#000] text-[11px]"
              style={{ backgroundColor: 'var(--rainbow-yellow)', color: 'var(--text-primary)' }}
            >
              ENTER THE WORLD
            </button>
          </div>
        </section>
      )}

      {phase === "home" && (
        <section className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-4xl border-4 border-black rounded-none p-8 md:p-12 shadow-[10px_10px_0_0_#000]" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <p className="text-[10px] tracking-[0.22em] mb-4" style={{ color: 'var(--rainbow-red)' }}>NINTENDO STYLE PIXEL ADVENTURE</p>
            <h1 className="rainbow-text text-4xl md:text-6xl mb-5 leading-tight" style={{ color: 'var(--rainbow-blue)' }}>IK KUDI</h1>
            <p className="text-[11px] md:text-xs max-w-3xl leading-7 mb-10" style={{ color: 'var(--text-primary)' }}>
              Ride forward, jump over danger, and keep the journey alive. The road is endless,
              the sky shifts from day to night, and your story keeps unfolding with every meter.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/game"
                className="px-7 py-4 border-4 border-black hover:opacity-90 transition-colors shadow-[6px_6px_0_0_#000] text-[11px]"
                style={{ backgroundColor: 'var(--rainbow-yellow)', color: 'var(--text-primary)' }}
              >
                PRESS START
              </Link>
              <span className="px-4 py-3 border-4 border-black text-[10px]" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                SPACE = JUMP
              </span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
