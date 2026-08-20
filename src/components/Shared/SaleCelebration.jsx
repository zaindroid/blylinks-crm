import React, { useEffect } from 'react';
import { Star } from 'lucide-react';

const STAR_COUNT = 14;

export default function SaleCelebration({ quote, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    size: 10 + Math.random() * 18,
    duration: 1.4 + Math.random() * 0.8
  }));

  return (
    <div className="sale-celebration-overlay">
      {stars.map((s, i) => (
        <Star
          key={i}
          className="sale-celebration-star"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`
          }}
        />
      ))}
      <div className="sale-celebration-card">
        <Star size={28} className="sale-celebration-badge" />
        <div className="sale-celebration-quote">{quote}</div>
      </div>

      <style>{`
        .sale-celebration-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2000;
          overflow: hidden;
        }
        .sale-celebration-star {
          position: absolute;
          top: -30px;
          color: #fbbf24;
          fill: #fbbf24;
          animation: sale-celebration-fall linear forwards;
        }
        @keyframes sale-celebration-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(340deg); opacity: 0; }
        }
        .sale-celebration-card {
          position: absolute;
          top: 18%;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          border-radius: var(--radius-md, 12px);
          padding: 1.25rem 1.75rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          max-width: 380px;
          animation: sale-celebration-pop 0.4s ease;
        }
        .sale-celebration-badge { color: #fbbf24; fill: #fbbf24; flex-shrink: 0; }
        .sale-celebration-quote { font-weight: 700; font-size: 0.95rem; color: var(--text-main); }
        @keyframes sale-celebration-pop {
          0% { transform: translateX(-50%) scale(0.7); opacity: 0; }
          60% { transform: translateX(-50%) scale(1.05); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
