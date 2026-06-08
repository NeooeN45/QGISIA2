/**
 * WaveBackground — Fond de vagues SVG animées, discrètes et élégantes.
 *
 * Remplace GeoParticlesBackground (canvas 2D avec nœuds volants).
 * 3 couches de vagues sinusoïdales en teintes bleues/violet, avec
 * animation CSS pure — aucune dépendance, 0 canvas, très léger.
 *
 * Props :
 *   isDark — true = dark mode, false = light mode (opacités adaptées)
 */

interface WaveBackgroundProps {
  isDark: boolean;
}

export default function GeoParticlesBackground({ isDark }: WaveBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Vague 1 — grande, lente, bleue profonde */}
          <path id="wave1" d="M0,400 C180,340 360,460 540,400 C720,340 900,460 1080,400 C1260,340 1380,420 1440,400 L1440,900 L0,900 Z" />
          {/* Vague 2 — moyenne, violette */}
          <path id="wave2" d="M0,520 C200,460 400,580 600,520 C800,460 1000,580 1200,520 C1350,470 1420,530 1440,520 L1440,900 L0,900 Z" />
          {/* Vague 3 — petite, cyan, avant-plan */}
          <path id="wave3" d="M0,640 C240,590 480,680 720,640 C960,590 1200,680 1440,640 L1440,900 L0,900 Z" />

          {/* Gradient vague 1 */}
          <linearGradient id="wg1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={isDark ? "#1e3a8a" : "#dbeafe"} stopOpacity={isDark ? "0.28" : "0.35"} />
            <stop offset="50%"  stopColor={isDark ? "#3730a3" : "#c7d2fe"} stopOpacity={isDark ? "0.22" : "0.28"} />
            <stop offset="100%" stopColor={isDark ? "#1e3a8a" : "#dbeafe"} stopOpacity={isDark ? "0.28" : "0.35"} />
          </linearGradient>

          {/* Gradient vague 2 */}
          <linearGradient id="wg2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={isDark ? "#4c1d95" : "#ede9fe"} stopOpacity={isDark ? "0.18" : "0.25"} />
            <stop offset="50%"  stopColor={isDark ? "#5b21b6" : "#ddd6fe"} stopOpacity={isDark ? "0.14" : "0.20"} />
            <stop offset="100%" stopColor={isDark ? "#4c1d95" : "#ede9fe"} stopOpacity={isDark ? "0.18" : "0.25"} />
          </linearGradient>

          {/* Gradient vague 3 */}
          <linearGradient id="wg3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={isDark ? "#164e63" : "#cffafe"} stopOpacity={isDark ? "0.12" : "0.18"} />
            <stop offset="50%"  stopColor={isDark ? "#0e7490" : "#a5f3fc"} stopOpacity={isDark ? "0.10" : "0.15"} />
            <stop offset="100%" stopColor={isDark ? "#164e63" : "#cffafe"} stopOpacity={isDark ? "0.12" : "0.18"} />
          </linearGradient>
        </defs>

        {/* Fond dégradé très subtil */}
        <rect
          width="1440"
          height="900"
          fill={isDark
            ? "url(#bgGradDark)"
            : "url(#bgGradLight)"}
        />
        <defs>
          <linearGradient id="bgGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#0f172a" stopOpacity="0" />
            <stop offset="60%"  stopColor="#1e1b4b" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bgGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#eff6ff" stopOpacity="0" />
            <stop offset="60%"  stopColor="#eef2ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f0fdfa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ── Vague 1 ── grande et lente */}
        <g className="wave-group-1">
          <use
            href="#wave1"
            fill="url(#wg1)"
            style={{ animation: "wave-drift-1 18s ease-in-out infinite alternate" }}
          />
        </g>

        {/* ── Vague 2 ── moyenne, décalée */}
        <g className="wave-group-2">
          <use
            href="#wave2"
            fill="url(#wg2)"
            style={{ animation: "wave-drift-2 24s ease-in-out infinite alternate" }}
          />
        </g>

        {/* ── Vague 3 ── fine, au premier plan */}
        <g className="wave-group-3">
          <use
            href="#wave3"
            fill="url(#wg3)"
            style={{ animation: "wave-drift-3 14s ease-in-out infinite alternate" }}
          />
        </g>
      </svg>

      <style>{`
        @keyframes wave-drift-1 {
          0%   { transform: translateX(0px) translateY(0px) scaleY(1); }
          33%  { transform: translateX(-28px) translateY(12px) scaleY(1.04); }
          66%  { transform: translateX(18px) translateY(-8px) scaleY(0.97); }
          100% { transform: translateX(-12px) translateY(6px) scaleY(1.02); }
        }
        @keyframes wave-drift-2 {
          0%   { transform: translateX(0px) translateY(0px) scaleY(1); }
          33%  { transform: translateX(22px) translateY(-14px) scaleY(1.03); }
          66%  { transform: translateX(-30px) translateY(10px) scaleY(0.98); }
          100% { transform: translateX(16px) translateY(-6px) scaleY(1.01); }
        }
        @keyframes wave-drift-3 {
          0%   { transform: translateX(0px) translateY(0px); }
          50%  { transform: translateX(35px) translateY(-10px); }
          100% { transform: translateX(-20px) translateY(8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wave-group-1, .wave-group-2, .wave-group-3 {
            animation: none !important;
          }
          .wave-group-1 use, .wave-group-2 use, .wave-group-3 use {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
