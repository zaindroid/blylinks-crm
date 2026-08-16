import React, { useEffect, useRef, useState } from 'react';

// Fullscreen triangle -- cheaper than a quad (one draw call, no index buffer).
const VERTEX_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// A slow-drifting, layered flow field in the app's own palette (deep ink
// background, indigo/violet accent -- see index.css --bg-primary/--accent).
// Value noise + fbm, no external deps -- keeps this component self-contained
// and the bundle light, which matters more here than shader sophistication.
const FRAGMENT_SRC = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = (uv * 2.0 - 1.0);
  p.x *= uResolution.x / uResolution.y;

  // Faster, livelier drift than a moody slow-burn -- this is meant to read
  // as bright and energetic, not atmospheric.
  float t = uTime * 0.09;
  float n = fbm(p * 1.2 + vec2(t, -t * 0.7));
  float n2 = fbm(p * 1.9 - vec2(-t * 0.5, t * 0.9) + 4.0);
  float n3 = fbm(p * 1.5 + vec2(t * 0.6, t * 0.4) + 9.0);

  // Near-white base (matches --bg-primary), softly tinted by three brand-
  // adjacent hues as blurred mesh-gradient blobs -- the light, airy "fresh
  // SaaS" look, not a dark void.
  vec3 base = vec3(0.976, 0.980, 0.992);
  vec3 indigo = vec3(0.310, 0.275, 0.898);   // --accent #4f46e5
  vec3 violet = vec3(0.663, 0.545, 0.984);   // lighter violet lift
  vec3 sky = vec3(0.376, 0.647, 0.980);      // fresh cyan-blue accent

  vec3 color = base;
  color = mix(color, indigo, smoothstep(0.45, 0.95, n) * 0.30);
  color = mix(color, violet, smoothstep(0.5, 0.95, n2) * 0.26);
  color = mix(color, sky, smoothstep(0.55, 0.95, n3) * 0.22);

  // Gentle brightening toward center -- an inverted, soft glow instead of
  // a vignette, keeps the middle (where the logo sits) crisp and airy.
  float dist = length(p);
  float centerLift = smoothstep(1.1, 0.0, dist) * 0.12;
  color = mix(color, vec3(1.0), centerLift);

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

// Renders the animated background only if WebGL is actually available --
// on anything that can't do WebGL (rare, but real: locked-down browsers,
// some headless/automation contexts), this silently no-ops and the CSS
// gradient fallback in the wrapper's background is what's seen instead.
// The splash still works fully either way, just without the live shader.
function useWebGLBackground(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false })
      || canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
    if (!gl) return undefined;

    let program;
    try {
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
      program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('LoadingScreen: WebGL init failed, falling back to CSS background', err);
      return undefined;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // One triangle covering the full clip space, corners well past [-1,1]
    // so the visible viewport is a clean full-bleed rectangle.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 3, -1, -1, 3,
    ]), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');

    let raf = null;
    let start = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function render(now) {
      resize();
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    }

    resize();
    raf = requestAnimationFrame(render);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
    };
  }, [canvasRef]);
}

// visible: whether the splash should be mounted/shown at all.
// fading: set true once the app is actually ready, triggers the fade-out;
// onFadeOutComplete fires after the CSS transition ends so the parent can
// unmount this without an abrupt cut.
export default function LoadingScreen({ fading, onFadeOutComplete }) {
  const canvasRef = useRef(null);
  const [entered, setEntered] = useState(false);
  useWebGLBackground(canvasRef);

  useEffect(() => {
    // Two rAFs so the initial (pre-enter) styles actually paint before the
    // transition to the entered state kicks in -- avoids the browser
    // coalescing both into one frame and skipping the entrance animation.
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  return (
    <div
      className={`loading-screen${entered ? ' is-entered' : ''}${fading ? ' is-fading' : ''}`}
      onTransitionEnd={e => {
        if (fading && e.propertyName === 'opacity') onFadeOutComplete?.();
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading Blylinks Operations Portal"
    >
      <canvas ref={canvasRef} className="loading-screen__canvas" />
      <div className="loading-screen__content">
        <img src="/blylinks-logo.png" alt="Blylinks" className="loading-screen__logo" />
        <div className="loading-screen__wordmark">Blylinks</div>
        <div className="loading-screen__subtitle">Operations Portal</div>
        <div className="loading-screen__dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>

      <style>{`
        .loading-screen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 45%, #ffffff 0%, #f4f5fb 60%, #eef0f9 100%);
          opacity: 1;
          transition: opacity 0.6s ease;
        }
        .loading-screen.is-fading {
          opacity: 0;
          pointer-events: none;
        }
        .loading-screen__canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
        }
        .loading-screen__content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.4rem;
          opacity: 0;
          transform: translateY(14px) scale(0.97);
          transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .loading-screen.is-entered .loading-screen__content {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .loading-screen__logo {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.10),
                      0 14px 36px -10px rgba(79, 70, 229, 0.45);
          margin-bottom: 0.75rem;
        }
        .loading-screen__wordmark {
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #14151f;
        }
        .loading-screen__subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(79, 70, 229, 0.55);
          margin-bottom: 1.6rem;
        }
        .loading-screen__dots {
          display: flex;
          gap: 6px;
        }
        .loading-screen__dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4f46e5;
          opacity: 0.4;
          animation: loading-dot-pulse 1.2s ease-in-out infinite;
        }
        .loading-screen__dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-screen__dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes loading-dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .loading-screen__dots span { animation: none; opacity: 0.7; }
          .loading-screen__content { transition: opacity 0.3s ease; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
