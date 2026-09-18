import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, X, Target } from 'lucide-react';
import { playBlylinksTone } from '../../utils/sound';

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#facc15', '#22d3ee'];
const PIECES_BY_INTENSITY = { normal: 70, big: 120, epic: 190 };
const VISIBLE_MS = { normal: 8000, big: 10000, epic: 12000 };

const rnd = (min, max) => min + Math.random() * (max - min);

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Confetti fired from both bottom corners, plus a light rain from the top. Each piece is one
// absolutely-positioned element animated purely with CSS (variables carry its own trajectory),
// so a big celebration costs no JS after the first render.
function makeConfetti(count) {
  return Array.from({ length: count }, (_, i) => {
    const kind = i % 5 === 0 ? 'rain' : i % 2 === 0 ? 'left' : 'right';
    const size = rnd(6, 12);
    const shape = ['rect', 'square', 'circle'][Math.floor(Math.random() * 3)];
    const rot = `${Math.round(rnd(360, 1080)) * (Math.random() < 0.5 ? -1 : 1)}deg`;
    const dir = kind === 'right' ? -1 : 1;
    return {
      kind,
      shape,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      width: shape === 'rect' ? size : size * 0.75,
      height: shape === 'rect' ? size * 0.45 : size * 0.75,
      vars: {
        '--rot': rot,
        '--delay': `${kind === 'rain' ? rnd(0.2, 2.2) : rnd(0, 0.35)}s`,
        '--dur': `${kind === 'rain' ? rnd(2.6, 4.2) : rnd(2.4, 3.6)}s`,
        '--drift': `${Math.round(rnd(-8, 8))}vw`,
        '--x1': `${Math.round(dir * rnd(12, 55))}vw`,
        '--y1': `${-Math.round(rnd(35, 88))}vh`,
        '--x2': `${Math.round(dir * rnd(20, 75))}vw`,
        '--y2': `${Math.round(rnd(5, 18))}vh`
      },
      left: kind === 'rain' ? `${rnd(0, 100)}%` : undefined
    };
  });
}

export default function SaleCelebration({ celebration, onDone }) {
  const { headline, message, stats = [], tracker, intensity = 'normal' } = celebration;
  const [hovered, setHovered] = useState(false);
  const confetti = useMemo(
    () => (prefersReducedMotion() ? [] : makeConfetti(PIECES_BY_INTENSITY[intensity] || PIECES_BY_INTENSITY.normal)),
    [intensity]
  );

  useEffect(() => { playBlylinksTone('success'); }, []);

  // Stays up long enough to actually read; hovering over it (or focusing inside) holds it open.
  useEffect(() => {
    if (hovered) return undefined;
    const timer = setTimeout(onDone, VISIBLE_MS[intensity] || VISIBLE_MS.normal);
    return () => clearTimeout(timer);
  }, [hovered, intensity, onDone]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div className="sale-celebration-overlay">
      {confetti.map((c, i) => (
        <span
          key={i}
          className={`confetti-piece confetti-${c.kind} ${c.shape === 'circle' ? 'confetti-round' : ''}`}
          style={{ background: c.color, width: c.width, height: c.height, left: c.left, ...c.vars }}
          aria-hidden="true"
        />
      ))}

      <div
        className={`sale-celebration-card intensity-${intensity}`}
        role="status"
        aria-live="polite"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <button type="button" className="sale-celebration-close" onClick={onDone} aria-label="Close celebration">
          <X size={16} />
        </button>

        <div className="sale-celebration-trophy"><Trophy size={30} /></div>
        <div className="sale-celebration-headline">{headline}</div>
        <div className="sale-celebration-message">{message}</div>

        {stats.length > 0 && (
          <div className="sale-celebration-stats">
            {stats.map(s => (
              <div key={s.label} className="sale-celebration-stat">
                <span className="sale-celebration-stat-value">{s.value}</span>
                <span className="sale-celebration-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {tracker && (
          <div className="sale-celebration-tracker">
            <div className="sale-celebration-tracker-line">
              <Target size={14} /> <span>{tracker.line}</span>
            </div>
            <div
              className="sale-celebration-progress"
              role="progressbar"
              aria-label={tracker.title || 'Monthly sales goal progress'}
              aria-valuemin={0}
              aria-valuemax={tracker.goal}
              aria-valuenow={Math.min(tracker.current, tracker.goal)}
            >
              <div className={`sale-celebration-progress-fill ${tracker.reached ? 'reached' : ''}`} style={{ '--pct': `${tracker.pct}%` }} />
            </div>
            <div className="sale-celebration-progress-label">{Math.min(tracker.current, tracker.goal)} / {tracker.goal} &middot; {tracker.pct}%</div>
          </div>
        )}
      </div>

      <style>{`
        .sale-celebration-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2000; overflow: hidden; }

        .confetti-piece { position: absolute; display: block; opacity: 0; will-change: transform, opacity; }
        .confetti-round { border-radius: 50%; }
        .confetti-rain { top: -20px; animation: confetti-fall var(--dur) linear var(--delay) forwards; }
        .confetti-left { bottom: -12px; left: 0; animation: confetti-burst var(--dur) cubic-bezier(0.15, 0.7, 0.3, 1) var(--delay) forwards; }
        .confetti-right { bottom: -12px; right: 0; animation: confetti-burst var(--dur) cubic-bezier(0.15, 0.7, 0.3, 1) var(--delay) forwards; }

        @keyframes confetti-fall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift), 108vh, 0) rotate(var(--rot)); opacity: 0.85; }
        }
        @keyframes confetti-burst {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          45% { transform: translate3d(var(--x1), var(--y1), 0) rotate(calc(var(--rot) * 0.5)); opacity: 1; }
          100% { transform: translate3d(var(--x2), var(--y2), 0) rotate(var(--rot)); opacity: 0; }
        }

        .sale-celebration-card {
          position: absolute;
          top: 14%;
          left: 50%;
          transform: translateX(-50%);
          width: min(430px, calc(100vw - 32px));
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-top: 4px solid #f59e0b;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.32);
          border-radius: 16px;
          padding: 1.4rem 1.5rem 1.25rem;
          text-align: center;
          pointer-events: auto;
          animation: sale-celebration-pop 0.5s cubic-bezier(0.2, 1.2, 0.4, 1);
        }
        .sale-celebration-card.intensity-big { border-top-color: #ec4899; }
        .sale-celebration-card.intensity-epic { border-top-color: #8b5cf6; box-shadow: 0 18px 70px rgba(139, 92, 246, 0.45); }

        .sale-celebration-close { position: absolute; top: 0.55rem; right: 0.55rem; background: none; border: none; color: var(--text-subtle); cursor: pointer; padding: 0.25rem; border-radius: 6px; display: flex; }
        .sale-celebration-close:hover { color: var(--text-main); background: var(--bg-primary); }

        .sale-celebration-trophy {
          width: 58px; height: 58px; margin: 0 auto 0.6rem; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; background: linear-gradient(135deg, #f59e0b, #ef4444);
          box-shadow: 0 6px 18px rgba(245, 158, 11, 0.5);
          animation: sale-celebration-bounce 1.1s ease-in-out 0.4s 2;
        }
        .sale-celebration-headline { font-family: var(--font-display); font-weight: 800; font-size: 1.25rem; color: var(--text-main); line-height: 1.2; }
        .sale-celebration-message { margin-top: 0.45rem; font-size: 0.9rem; color: var(--text-muted); line-height: 1.45; }

        .sale-celebration-stats { display: flex; justify-content: center; gap: 0.6rem; margin-top: 0.95rem; }
        .sale-celebration-stat { min-width: 92px; padding: 0.45rem 0.8rem; border-radius: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); display: flex; flex-direction: column; align-items: center; }
        .sale-celebration-stat-value { font-size: 1.35rem; font-weight: 800; color: var(--accent); line-height: 1.1; }
        .sale-celebration-stat-label { font-size: 0.64rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-subtle); }

        .sale-celebration-tracker { margin-top: 1rem; text-align: left; }
        .sale-celebration-tracker-line { display: flex; align-items: flex-start; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; color: var(--text-main); }
        .sale-celebration-tracker-line svg { flex-shrink: 0; margin-top: 2px; color: var(--accent); }
        .sale-celebration-progress { margin-top: 0.5rem; height: 10px; border-radius: 999px; background: var(--bg-primary); border: 1px solid var(--border-color); overflow: hidden; }
        .sale-celebration-progress-fill { height: 100%; width: 0; border-radius: 999px; background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899); animation: sale-celebration-fill 1.2s ease-out 0.5s forwards; }
        .sale-celebration-progress-fill.reached { background: linear-gradient(90deg, #10b981, #facc15); }
        .sale-celebration-progress-label { margin-top: 0.3rem; font-size: 0.7rem; font-weight: 700; color: var(--text-subtle); text-align: right; }

        @keyframes sale-celebration-fill { to { width: var(--pct); } }
        @keyframes sale-celebration-pop {
          0% { transform: translateX(-50%) scale(0.6); opacity: 0; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes sale-celebration-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-9px) scale(1.08); }
        }

        @media (prefers-reduced-motion: reduce) {
          .confetti-piece { display: none; }
          .sale-celebration-card, .sale-celebration-trophy { animation: none; }
          .sale-celebration-progress-fill { animation: none; width: var(--pct); }
        }
      `}</style>
    </div>
  );
}
