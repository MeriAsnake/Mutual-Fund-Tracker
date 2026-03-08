import { useState } from "react";

export default function PredictionMarket() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060A10",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(201,126,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(201,126,255,0.05) 1px,transparent 1px)`,
        backgroundSize: "44px 44px",
      }} />

      <div style={{ textAlign: "center", maxWidth: 520, position: "relative", zIndex: 1 }}>

        {/* Glow orb */}
        <div style={{
          width: 180, height: 180, borderRadius: "50%", margin: "0 auto 36px",
          background: "radial-gradient(circle, #C97EFF30 0%, #C97EFF08 60%, transparent 100%)",
          border: "1px solid #C97EFF25",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 80px #C97EFF20",
          animation: "pulse 3s ease-in-out infinite",
        }}>
          <span style={{ fontSize: 64 }}>🔮</span>
        </div>

        {/* Label */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "#C97EFF14", border: "1px solid #C97EFF30",
          borderRadius: 20, padding: "5px 14px", marginBottom: 20,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C97EFF", animation: "blink 2s infinite" }} />
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#C97EFF", letterSpacing: "0.18em" }}>COMING SOON</span>
        </div>

        <h1 style={{
          fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px,5vw,46px)",
          fontWeight: 800, margin: "0 0 14px",
          background: "linear-gradient(135deg, #C97EFF, #4B9EFF)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "-0.025em",
        }}>
          Prediction Market
        </h1>

        <p style={{ color: "#64748B", fontSize: 15, lineHeight: 1.7, margin: "0 0 36px" }}>
          Trade on outcomes. Forecast market events. Earn from your edge.<br />
          We're building something powerful — stay ahead of the curve.
        </p>

        {/* Feature previews */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 40 }}>
          {[
            { icon: "📊", label: "Outcome Markets", desc: "Trade yes/no on market events" },
            { icon: "🎯", label: "Accuracy Score", desc: "Track your prediction record" },
            { icon: "💎", label: "Leaderboard", desc: "Compete with top forecasters" },
          ].map((f, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.025)", border: "1px solid #1A2235",
              borderRadius: 14, padding: "18px 14px",
              transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: "#D8E4F0", marginBottom: 5 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: "#4A5568", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Notify form */}
        {!submitted ? (
          <div style={{ display: "flex", gap: 10, maxWidth: 380, margin: "0 auto" }}>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                flex: 1, background: "rgba(255,255,255,0.03)",
                border: "1px solid #1A2235", borderRadius: 10,
                color: "#D8E4F0", padding: "11px 14px", fontSize: 13,
                fontFamily: "'DM Sans',sans-serif", outline: "none",
              }}
              onKeyDown={e => e.key === "Enter" && email && setSubmitted(true)}
            />
            <button
              onClick={() => email && setSubmitted(true)}
              style={{
                padding: "11px 20px", background: "#C97EFF", border: "none",
                borderRadius: 10, color: "#060A10", cursor: "pointer",
                fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13,
                boxShadow: "0 0 24px #C97EFF35", whiteSpace: "nowrap",
              }}
            >
              Notify Me
            </button>
          </div>
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "#C97EFF14", border: "1px solid #C97EFF40",
            borderRadius: 12, padding: "12px 22px",
          }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#C97EFF" }}>
              You're on the list — we'll let you know!
            </span>
          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.04);opacity:0.85;} }
        @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
