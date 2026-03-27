import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import "./login.css";

// ── helpers ───────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lampLit, setLampLit] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);

  // refs for canvas + cord
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const cordSvgRef = useRef<SVGSVGElement>(null);
  const cordPathRef = useRef<SVGPathElement>(null);
  const cordKnobRef = useRef<SVGGElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const coneRef = useRef<HTMLDivElement>(null);
  const panelBorderRef = useRef<HTMLDivElement>(null);
  const lockFaceRef = useRef<HTMLDivElement>(null);
  const keyholeRef = useRef<HTMLDivElement>(null);
  const shackleRef = useRef<HTMLDivElement>(null);
  const lockBodyRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // dial state
  const dialAngles = useRef([0, 0, 0, 0]);
  const dialValues = useRef([0, 0, 0, 0]);
  const dialIdleTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // cord physics
  const pulling = useRef(false);
  const startY = useRef(0);
  const currentPull = useRef(0);
  const cordAnimTimer = useRef<ReturnType<typeof setInterval>>();
  const lampLitRef = useRef(false);

  // ── Starfield canvas ──────────────────────────────────
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.008,
      speed: Math.random() * 0.12 + 0.02,
    }));

    let particles: any[] = [];
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        s.a += s.da;
        if (s.a > 1 || s.a < 0) s.da *= -1;
        s.y += s.speed;
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${lampLitRef.current ? "100,200,255" : "80,120,180"},${s.a * 0.6})`;
        ctx.fill();
      });

      if (lampLitRef.current) {
        particles = particles.filter((p) => p.life > 0);
        particles.forEach((p) => {
          p.x += p.vx; p.y += p.vy; p.vy -= 0.015; p.life -= 1;
          const a = (p.life / p.maxLife) * 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,${180 + Math.random() * 75},255,${a})`;
          ctx.fill();
        });
        if (Math.random() < 0.08) {
          const cx = window.innerWidth / 2;
          particles.push({
            x: cx + (Math.random() - 0.5) * 300,
            y: window.innerHeight * 0.6,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -Math.random() * 1.2 - 0.3,
            r: Math.random() * 2 + 0.5,
            life: 80 + Math.random() * 60,
            maxLife: 140,
          });
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  // ── Cord physics ──────────────────────────────────────
  const updateCord = (pull: number, sway = 0) => {
    if (!cordPathRef.current || !cordKnobRef.current || !cordSvgRef.current) return;
    cordPathRef.current.setAttribute("d", `M10,0 Q${10 + sway},${30 + pull * 0.4} 10,${55 + pull * 0.2} Q${10 - sway * 0.5},${80 + pull * 0.15} 10,${100 + pull}`);
    cordKnobRef.current.setAttribute("transform", `translate(${10 + sway * 0.3},${100 + pull})`);
    cordSvgRef.current.setAttribute("height", String(110 + pull));
    cordSvgRef.current.setAttribute("viewBox", `0 0 20 ${110 + pull}`);
  };

  const snapCordBack = () => {
    let p = currentPull.current, sway = 0, swayDir = 1;
    clearInterval(cordAnimTimer.current);
    cordAnimTimer.current = setInterval(() => {
      p *= 0.75; sway = sway * 0.6 + swayDir * 3; swayDir *= -0.7;
      if (Math.abs(p) < 0.5 && Math.abs(sway) < 0.2) { p = 0; sway = 0; clearInterval(cordAnimTimer.current); }
      updateCord(p, sway);
      currentPull.current = p;
    }, 16);
  };

  const triggerLamp = () => {
    lampLitRef.current = true;
    setLampLit(true);
    shadeRef.current?.classList.add("glowing");
    ambientRef.current?.classList.add("lit");
    floorRef.current?.classList.add("lit");
    coneRef.current?.classList.add("lit");
    setTimeout(() => { setPanelVisible(true); startDialIdle(); }, 500);
  };

  useEffect(() => {
    const svg = cordSvgRef.current;
    if (!svg) return;

    const onDown = (e: MouseEvent) => { pulling.current = true; startY.current = e.clientY; e.preventDefault(); };
    const onMove = (e: MouseEvent) => {
      if (!pulling.current) return;
      const dy = Math.max(0, Math.min(55, e.clientY - startY.current));
      currentPull.current = dy;
      updateCord(dy, (e.clientX - (svg.getBoundingClientRect().left + 10)) * 0.15);
    };
    const onUp = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (currentPull.current > 20 && !lampLitRef.current) triggerLamp();
      snapCordBack();
    };

    svg.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      svg.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Dial spin ─────────────────────────────────────────
  const spinDial = (idx: number, targetDigit: number, duration = 600, extraSpins = 0) => {
    return new Promise<void>((resolve) => {
      const face = document.getElementById(`dialFace${idx}`);
      const win = document.getElementById(`dw${idx}`);
      if (!face || !win) { resolve(); return; }

      const startAngle = dialAngles.current[idx];
      const degsPerDigit = 36;
      let diff = targetDigit - dialValues.current[idx];
      if (diff <= 0) diff += 10;
      const totalDeg = extraSpins * 360 + diff * degsPerDigit;
      const endAngle = startAngle + totalDeg;
      const startTime = performance.now();
      let lastFlashed = -1;

      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const angle = startAngle + (endAngle - startAngle) * ease;
        dialAngles.current[idx] = angle;
        face.style.transform = `rotate(${angle}deg)`;

        const curDig = Math.round((angle / degsPerDigit) % 10 + 10) % 10;
        if (curDig !== lastFlashed) {
          win.style.transform = "translateY(-3px)";
          setTimeout(() => { win.style.transform = ""; }, 60);
          lastFlashed = curDig;
          win.textContent = String(curDig);
          dialValues.current[idx] = curDig;
        }

        if (t < 1) requestAnimationFrame(animate);
        else {
          dialAngles.current[idx] = endAngle;
          dialValues.current[idx] = targetDigit;
          win.textContent = String(targetDigit);
          face.style.transform = `rotate(${endAngle}deg)`;
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  };

  const startDialIdle = () => {
    dialIdleTimers.current.forEach(clearTimeout);
    dialIdleTimers.current = [];
    const idleSpin = (idx: number) => {
      const t = setTimeout(async () => {
        if (!lampLitRef.current) return;
        await spinDial(idx, Math.floor(Math.random() * 10), 400);
        idleSpin(idx);
      }, 1500 + idx * 700 + Math.random() * 2000);
      dialIdleTimers.current.push(t);
    };
    [0, 1, 2, 3].forEach(idleSpin);
  };

  const stopDialIdle = () => { dialIdleTimers.current.forEach(clearTimeout); dialIdleTimers.current = []; };

  // ── Auth ──────────────────────────────────────────────
  const handleAuth = async () => {
    if (!email || !password) { shakePanel(); return; }

    const btn = btnRef.current;
    if (btn) { btn.textContent = "VERIFYING..."; btn.classList.add("scanning"); }
    setError("");
    setLoading(true);
    stopDialIdle();

    // Animate lock processing
    await Promise.all([
      spinDial(0, Math.floor(Math.random() * 10), 300, 1),
      new Promise<void>((r) => setTimeout(async () => { await spinDial(1, Math.floor(Math.random() * 10), 300, 1); r(); }, 100)),
      new Promise<void>((r) => setTimeout(async () => { await spinDial(2, Math.floor(Math.random() * 10), 300, 1); r(); }, 200)),
      new Promise<void>((r) => setTimeout(async () => { await spinDial(3, Math.floor(Math.random() * 10), 300, 1); r(); }, 300)),
    ]);

    if (keyholeRef.current) keyholeRef.current.style.boxShadow = "0 0 25px rgba(0,220,255,1), inset 0 0 15px rgba(0,180,255,0.6)";

    try {
      await login(email, password);

      // Grant access animation
      await Promise.all([
        spinDial(0, 4, 500), spinDial(1, 2, 550),
        spinDial(2, 7, 600), spinDial(3, 9, 650),
      ]);
      await delay(200);

      if (shackleRef.current) {
        shackleRef.current.style.transform = "rotate(-70deg) translateX(8px)";
        shackleRef.current.style.filter = "drop-shadow(0 0 20px rgba(0,255,150,1))";
      }
      if (lockFaceRef.current) {
        lockFaceRef.current.style.background = "linear-gradient(145deg, #002a1a, #004422)";
        lockFaceRef.current.style.borderColor = "rgba(0,255,120,0.8)";
        lockFaceRef.current.style.boxShadow = "0 0 30px rgba(0,255,100,0.5)";
      }
      if (panelBorderRef.current) {
        panelBorderRef.current.style.background = "linear-gradient(135deg, rgba(0,255,120,0.9), rgba(0,180,80,0.7), rgba(0,255,120,0.9))";
      }

      await delay(800);
      navigate("/dashboard");

    } catch (err: any) {
      // Deny access animation
      await Promise.all([0, 1, 2, 3].map((i) => spinDial(i, Math.floor(Math.random() * 10), 400)));

      if (shackleRef.current) {
        shackleRef.current.style.transition = "transform 0.25s ease";
        shackleRef.current.style.transform = "rotate(-25deg)";
        shackleRef.current.style.filter = "drop-shadow(0 0 15px rgba(255,30,60,0.8))";
        await delay(250);
        shackleRef.current.style.transform = "rotate(0deg)";
        await delay(150);
        shackleRef.current.style.filter = "";
      }
      if (lockFaceRef.current) {
        lockFaceRef.current.style.background = "linear-gradient(145deg, #2a0010, #1a0008)";
        lockFaceRef.current.style.borderColor = "rgba(255,30,60,0.8)";
        lockFaceRef.current.style.boxShadow = "0 0 30px rgba(255,0,40,0.5)";
      }
      if (panelBorderRef.current) {
        panelBorderRef.current.style.background = "linear-gradient(135deg, rgba(255,30,60,0.9), rgba(180,0,30,0.7), rgba(255,30,60,0.9))";
        await delay(600);
        panelBorderRef.current.style.background = "";
      }
      if (lockFaceRef.current) {
        await delay(300);
        lockFaceRef.current.style.background = "";
        lockFaceRef.current.style.borderColor = "";
        lockFaceRef.current.style.boxShadow = "";
      }

      setError(err?.response?.data?.detail ?? "Identity verification failed.");
      startDialIdle();
    } finally {
      setLoading(false);
      if (btn) { btn.textContent = "AUTHENTICATE"; btn.classList.remove("scanning"); }
    }
  };

  const shakePanel = () => {
    const p = document.getElementById("mainPanel");
    if (!p) return;
    p.style.transition = "transform 0.08s";
    [-12, 12, -9, 9, -5, 5, 0].forEach((x, i) =>
      setTimeout(() => { p.style.transform = `translateX(${x}px)`; }, i * 65)
    );
    setTimeout(() => { p.style.transition = ""; }, 500);
  };

  return (
    <div className={`login-root${lampLit ? " lit" : ""}`}>
      <canvas id="bgCanvas" ref={bgCanvasRef} />
      <div id="ambientLight" ref={ambientRef} />
      <div id="floorReflect" ref={floorRef} />
      <div id="lightCone" ref={coneRef} />
      <div id="statusBar" />

      {/* Deco lines */}
      <div className="deco-line" style={{ top: "25%", left: 0, width: 90, height: 1 }} />
      <div className="deco-line" style={{ top: "25%", left: 88, width: 1, height: 50 }} />
      <div className="deco-line" style={{ top: "37%", left: 88, width: 40, height: 1 }} />
      <div className="deco-line" style={{ top: "60%", right: 0, width: 110, height: 1 }} />
      <div className="deco-dot" style={{ top: "25%", left: 88, width: 5, height: 5, animationDelay: "0s" }} />
      <div className="deco-dot" style={{ top: "48%", right: 110, width: 5, height: 5, animationDelay: "1.2s" }} />

      <div id="scene">
        {/* ── LAMP ── */}
        <div id="lampAssembly">
          <div className="lamp-shade-wrap">
            <div className="shade" ref={shadeRef}>
              <div className="shade-inner-glow" />
            </div>
            <div className="shade-rim" />
            <div className="pole" />
            <div className="base-plate" />
          </div>
          <div id="cordSystem">
            <svg ref={cordSvgRef} id="cordSvg" viewBox="0 0 20 110" height="110">
              <path ref={cordPathRef} id="cordPath" d="M10,0 Q12,30 10,55 Q8,80 10,100" />
              <g ref={cordKnobRef} id="cordKnob" transform="translate(10,100)">
                <circle r={9} fill="url(#knobGrad)" />
                <circle r={9} fill="none" stroke="rgba(255,160,40,0.5)" strokeWidth={1.5} />
                <circle r={5} fill="url(#knobGrad2)" opacity={0.8} />
                <ellipse cx={-2} cy={-3} rx={3} ry={2} fill="rgba(255,255,255,0.25)" />
                <defs>
                  <radialGradient id="knobGrad" cx="35%" cy="30%">
                    <stop offset="0%" stopColor="#ffcc44" />
                    <stop offset="50%" stopColor="#ff8800" />
                    <stop offset="100%" stopColor="#cc4400" />
                  </radialGradient>
                  <radialGradient id="knobGrad2" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#ffee88" />
                    <stop offset="100%" stopColor="#ff6600" />
                  </radialGradient>
                </defs>
              </g>
            </svg>
          </div>
        </div>

        {/* ── MAIN PANEL ── */}
        <div id="mainPanel" className={panelVisible ? "visible" : ""}>
          <div className="panel-glow-ring" />
          <div className="panel-border" ref={panelBorderRef}>
            <div className="panel-body">
              <div className="cb tl" /><div className="cb tr" />
              <div className="cb bl" /><div className="cb br" />
              <div className="side-line l" /><div className="side-line r" />

              <div className="panel-title">FLOWWA</div>
              <div className="panel-title-sub">WHATSAPP AUTOMATION · SECURE ACCESS</div>

              {/* 3D Lock */}
              <div id="lockStage">
                <div id="lockOuter">
                  <div id="shackle3d" ref={shackleRef}>
                    <svg className="shackle-svg" viewBox="0 0 48 52" fill="none">
                      <path d="M8 46 L8 20 Q8 6 24 6 Q40 6 40 20 L40 46"
                        stroke="url(#shackleGrad)" strokeWidth={6} strokeLinecap="round" fill="none"
                        filter="url(#shackleGlow)" />
                      <path d="M11 46 L11 21 Q11 10 24 10 Q37 10 37 21 L37 46"
                        stroke="rgba(180,220,255,0.25)" strokeWidth={2} strokeLinecap="round" fill="none" />
                      <defs>
                        <linearGradient id="shackleGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#60d0ff" />
                          <stop offset="50%" stopColor="#00aaee" />
                          <stop offset="100%" stopColor="#0066cc" />
                        </linearGradient>
                        <filter id="shackleGlow" x="-30%" y="-30%" width="160%" height="160%">
                          <feGaussianBlur in="SourceGraphic" stdDeviation={3} result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                    </svg>
                  </div>

                  <div className="lock-body-3d" ref={lockBodyRef}>
                    <div className="lock-face front" ref={lockFaceRef}>
                      <div className="keyhole-wrap">
                        <div className="keyhole-circle" ref={keyholeRef} />
                        <div className="keyhole-slot" />
                      </div>
                    </div>
                  </div>

                  <div id="dialWindows">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="dial-window">
                        <div className="dial-window-inner" id={`dw${i}`}>0</div>
                      </div>
                    ))}
                  </div>

                  <div id="dialSystem">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="dial-wrap">
                        <div className="dial" id={`dial${i}`}>
                          <div className="dial-face" id={`dialFace${i}`}>
                            <div className="dial-indicator" />
                            <div className="dial-center" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inputs */}
              <div className="input-group">
                <label>OPERATOR EMAIL</label>
                <div style={{ position: "relative" }}>
                  <div className="input-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth={1.5}>
                      <circle cx={12} cy={8} r={4} /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  </div>
                  <input
                    className="cyber-field"
                    type="email"
                    placeholder="ENTER EMAIL"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>ACCESS CODE</label>
                <div style={{ position: "relative" }}>
                  <div className="input-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth={1.5}>
                      <rect x={5} y={11} width={14} height={10} rx={2} />
                      <path d="M8 11V7a4 4 0 018 0v4" />
                    </svg>
                  </div>
                  <input
                    className="cyber-field"
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    autoComplete="off"
                  />
                </div>
              </div>

              <button
                id="authBtn"
                ref={btnRef}
                onClick={handleAuth}
                disabled={loading}
              >
                AUTHENTICATE
              </button>

              {error && (
                <div className="err-panel">
                  <div className="err-inner">
                    <div className="err-title">ACCESS DENIED</div>
                    <div className="err-message">{error}</div>
                    <div className="err-code">ERR::AUTH_FAILED · CODE 401 · {new Date().toISOString().substring(11, 19)} UTC</div>
                    <div className="err-progress"><div className="err-progress-bar" /></div>
                  </div>
                </div>
              )}

              <p className="hint-text">↓ PULL LAMP CORD TO INITIALIZE · ENTER CREDENTIALS · VERIFY ↓</p>

              <div className="register-link">
                NO ACCOUNT? <Link to="/register">REGISTER ACCESS</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
