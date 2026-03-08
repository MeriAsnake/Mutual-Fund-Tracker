const TRACKERS = [
  { id: "fund",       label: "Fund Tracker",     icon: "📊", color: "#05D48A", desc: "Mutual funds · 5-day picks" },
  { id: "stock",      label: "Stock Tracker",    icon: "📈", color: "#4B9EFF", desc: "Equities · Real-time prices" },
  { id: "prediction", label: "Prediction Market",icon: "🔮", color: "#C97EFF", desc: "Forecast · Coming soon" },
];

export default function TrackerSelector({ active, onChange, isDark, onToggleTheme }) {
  const bg       = isDark ? "rgba(6,10,16,0.88)"   : "rgba(238,242,255,0.95)";
  const border   = isDark ? "#1A2235"               : "#C5D0E8";
  const logoText = isDark ? "#4A5568"               : "#4A5A7A";
  const mutedBtn = isDark ? "#4A5568"               : "#4A5A7A";
  const hoverBg  = isDark ? "rgba(255,255,255,0.04)": "rgba(26,95,204,0.07)";
  const hoverCol = isDark ? "#D8E4F0"               : "#1A5FCC";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: bg, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      borderBottom: `1px solid ${border}`,
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{
        maxWidth: 1220, margin: "0 auto", padding: "0 20px",
        display: "flex", alignItems: "center", gap: 6, height: 54,
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 20, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #05D48A20, #4B9EFF20)",
            border: `1px solid ${border}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>⚡</div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: logoText, letterSpacing: "0.14em" }}>
            PICK TRACKER
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: border, marginRight: 10, flexShrink: 0 }} />

        {/* Tracker buttons */}
        {TRACKERS.map(t => (
          <button key={t.id} onClick={() => onChange(t.id)} title={t.desc} style={{
            padding: "7px 16px", borderRadius: 9, cursor: "pointer",
            border: active === t.id ? `1px solid ${t.color}50` : "1px solid transparent",
            background: active === t.id ? `${t.color}12` : "transparent",
            color: active === t.id ? t.color : mutedBtn,
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 7,
            transition: "all 0.18s", whiteSpace: "nowrap", letterSpacing: "0.04em",
          }}
            onMouseEnter={e => { if (active !== t.id) { e.currentTarget.style.color = hoverCol; e.currentTarget.style.background = hoverBg; }}}
            onMouseLeave={e => { if (active !== t.id) { e.currentTarget.style.color = mutedBtn; e.currentTarget.style.background = "transparent"; }}}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
            {t.id === "prediction" && (
              <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4, background: "#C97EFF20", color: "#C97EFF", border: "1px solid #C97EFF30", letterSpacing: "0.1em" }}>BETA</span>
            )}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Divider before toggle */}
        <div style={{ width: 1, height: 24, background: border, marginLeft: 4, flexShrink: 0 }} />

        {/* Elegant theme toggle button */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            flexShrink: 0,
            width: 36, height: 36,
            borderRadius: 10,
            border: `1px solid ${isDark ? "#1A2235" : "#C5D0E8"}`,
            background: isDark ? "rgba(75,158,255,0.08)" : "rgba(26,95,204,0.07)",
            cursor: "pointer",
            padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            outline: "none",
            position: "relative",
            overflow: "hidden",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark ? "rgba(75,158,255,0.16)" : "rgba(26,95,204,0.14)";
            e.currentTarget.style.borderColor = isDark ? "#4B9EFF50" : "#1A5FCC50";
            e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isDark ? "rgba(75,158,255,0.08)" : "rgba(26,95,204,0.07)";
            e.currentTarget.style.borderColor = isDark ? "#1A2235" : "#C5D0E8";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {/* Sun icon (light mode) */}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            style={{
              position: "absolute",
              opacity: isDark ? 0 : 1,
              transform: isDark ? "rotate(90deg) scale(0.5)" : "rotate(0deg) scale(1)",
              transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
              color: "#C47A00",
            }}
          >
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {/* Moon icon (dark mode) */}
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            style={{
              position: "absolute",
              opacity: isDark ? 1 : 0,
              transform: isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.5)",
              transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
              color: "#4B9EFF",
            }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>
          </svg>
        </button>

      </div>
    </div>
  );
}
