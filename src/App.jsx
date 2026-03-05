import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Theme definitions ─────────────────────────────────────────────────────────
const DARK = {
  bg:           "#060A10",
  bgModal:      "#0B111C",
  bgTableHead:  "#080E19",
  surface:      "rgba(255,255,255,0.025)",
  surfaceHover: "rgba(255,255,255,0.045)",
  border:       "#1A2235",
  muted:        "#4A5568",
  mutedLight:   "#64748B",
  text:         "#D8E4F0",
  textDim:      "#8899AA",
  green:        "#05D48A",
  red:          "#F05A5A",
  blue:         "#4B9EFF",
  amber:        "#F5A524",
  gridLine:     "rgba(26,34,53,0.5)",
  tooltipBg:    "#0B111C",
  scrollTrack:  "#060A10",
  scrollThumb:  "#1A2235",
  calIcon:      "invert(0.5)",
  toggleBg:     "#1A2235",
  toggleKnob:   "#4A5568",
  isDark:       true,
};
const LIGHT = {
  bg:           "#F0F4FA",
  bgModal:      "#FFFFFF",
  bgTableHead:  "#F8FAFD",
  surface:      "rgba(255,255,255,0.8)",
  surfaceHover: "rgba(255,255,255,1)",
  border:       "#D8E2EF",
  muted:        "#8A9BB5",
  mutedLight:   "#A0AEC0",
  text:         "#1A2235",
  textDim:      "#4A5568",
  green:        "#0BBF7A",
  red:          "#E04040",
  blue:         "#2B7EE0",
  amber:        "#D48C10",
  gridLine:     "rgba(216,226,239,0.6)",
  tooltipBg:    "#FFFFFF",
  scrollTrack:  "#F0F4FA",
  scrollThumb:  "#D8E2EF",
  calIcon:      "invert(0)",
  toggleBg:     "#D8E2EF",
  toggleKnob:   "#FFFFFF",
  isDark:       false,
};

const ThemeCtx = createContext(DARK);
const useT = () => useContext(ThemeCtx);

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = ["#05D48A","#4B9EFF","#F5A524","#C97EFF","#FF6F91","#00C9E0","#FF9A3C","#A8FF3E"];
const col = i => PALETTE[i % PALETTE.length];

// ── Storage ───────────────────────────────────────────────────────────────────
const KEY     = "mf-tracker-v5";
const KEY_THM = "mf-tracker-theme";
async function loadStorage() {
  try { const r = await window.storage.get(KEY); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function saveStorage(data) {
  try { await window.storage.set(KEY, JSON.stringify(data)); } catch {}
}
async function loadTheme() {
  try { const r = await window.storage.get(KEY_THM); return r ? r.value : "dark"; }
  catch { return "dark"; }
}
async function saveTheme(val) {
  try { await window.storage.set(KEY_THM, val); } catch {}
}

// ── Demo data ─────────────────────────────────────────────────────────────────
function makeDemoData() {
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function seedRand(str, salt) {
  let h = salt * 2654435761;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return ((h >>> 0) % 10000) / 10000;
}
function getDayData(ticker, expectedPct, numDays = 5) {
  const targetDaily = expectedPct / numDays;
  const pts = [{ day:0, label:"Day 0", cum:0, daily:0 }];
  let cum = 0;
  for (let d = 1; d <= numDays; d++) {
    const noise = (seedRand(ticker, d*7+13) - 0.5) * 2 * Math.abs(targetDaily) * 1.8;
    const pull  = (expectedPct - cum) * 0.25;
    const daily = +(targetDaily + noise + pull * 0.1).toFixed(3);
    cum = +(cum + daily).toFixed(3);
    pts.push({ day:d, label:`Day ${d}`, cum, daily });
  }
  return pts;
}
function daysSince(dateStr) { return Math.max(0, Math.floor((Date.now() - new Date(dateStr)) / 86400000)); }
function addDays(dateStr, n) { const d = new Date(dateStr); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function todayStr() { return new Date().toISOString().slice(0,10); }
function fmtDate(s) { return new Date(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function calcHitTarget(pick) {
  if (daysSince(pick.pickedDate) < 5) return null;
  const final = getDayData(pick.symbol, pick.expectedPct)[5].cum;
  if (pick.expectedPct > 0) return final > 0;
  if (pick.expectedPct < 0) return final < 0;
  return Math.abs(final) < 0.5;
}

// ── Theme Toggle button ───────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  const T = useT();
  return (
    <button onClick={onToggle} title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 10, cursor: "pointer", transition: "all 0.2s",
      color: T.text, fontFamily: "'DM Mono',monospace", fontSize: 11,
    }}
    onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
    onMouseLeave={e => e.currentTarget.style.background = T.surface}
    >
      <span style={{ fontSize: 15 }}>{isDark ? "☀️" : "🌙"}</span>
      <span style={{ color: T.muted }}>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────
function Pill({ children, color, filled, size = 10 }) {
  const T = useT();
  const c = color || T.muted;
  return (
    <span style={{ background: filled ? c+"20" : "transparent", color: filled ? c : T.muted, border:`1px solid ${c}35`, borderRadius:5, padding:"2px 8px", fontSize:size, fontFamily:"'DM Mono',monospace", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}
function Pct({ v, size = 13 }) {
  const T = useT();
  const pos = v >= 0;
  return <span style={{ color:pos?T.green:T.red, background:pos?T.green+"18":T.red+"18", border:`1px solid ${pos?T.green:T.red}30`, borderRadius:6, padding:"3px 9px", fontSize:size, fontFamily:"'DM Mono',monospace", fontWeight:600, whiteSpace:"nowrap" }}>{pos?"+":""}{v.toFixed(2)}%</span>;
}
function HitBadge({ hit, size = 10 }) {
  const T = useT();
  if (hit === null) return <Pill color={T.amber} filled size={size}>⏳ Pending</Pill>;
  return hit ? <Pill color={T.green} filled size={size}>✓ Hit</Pill> : <Pill color={T.red} filled size={size}>✗ Missed</Pill>;
}
function ProgressBar({ value, color, max = 5 }) {
  const T = useT();
  return (
    <div style={{ height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min((value/max)*100,100)}%`, background:color, borderRadius:2, transition:"width 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
    </div>
  );
}
function TTip({ active, payload, label }) {
  const T = useT();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:T.tooltipBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, boxShadow:"0 12px 40px #00000030" }}>
      <p style={{ color:T.muted, margin:"0 0 6px", fontSize:10 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color:p.color, margin:"2px 0" }}>{p.name}: <b>{(+p.value)>=0?"+":""}{(+p.value).toFixed(2)}%</b></p>)}
    </div>
  );
}

// ── Excel export ──────────────────────────────────────────────────────────────
function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX); s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function exportToExcel(picks) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const rows = [["Symbol","Company","Picked Date","End Date","Expected %","D1 %","D2 %","D3 %","D4 %","D5 %","Hit Target?"]];
  picks.forEach(pick => {
    const data = getDayData(pick.symbol, pick.expectedPct);
    const elapsed = daysSince(pick.pickedDate);
    const hit = calcHitTarget(pick);
    rows.push([
      pick.symbol, pick.company, pick.pickedDate, addDays(pick.pickedDate,5),
      pick.expectedPct/100,
      elapsed>=1?data[1].cum/100:"", elapsed>=2?data[2].cum/100:"",
      elapsed>=3?data[3].cum/100:"", elapsed>=4?data[4].cum/100:"",
      elapsed>=5?data[5].cum/100:"",
      hit===null?"Pending":hit?"YES":"NO",
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:10},{wch:32},{wch:13},{wch:13},{wch:13},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:13}];
  picks.forEach((_,i) => {
    const r = i+2;
    ["E","F","G","H","I","J"].forEach(c => { const cell = ws[c+r]; if (cell && cell.v!=="") cell.z="0.00%"; });
  });
  XLSX.utils.book_append_sheet(wb, ws, "MF Picks");
  XLSX.writeFile(wb, `MF_Picks_${todayStr()}.xlsx`);
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose, taken }) {
  const T = useT();
  const [symbol, setSymbol]     = useState("");
  const [company, setCompany]   = useState("");
  const [expected, setExpected] = useState("");
  const [pickedDate, setDate]   = useState(todayStr());
  const [err, setErr]           = useState("");

  const submit = () => {
    const s = symbol.trim().toUpperCase();
    const c = company.trim();
    const e = parseFloat(expected);
    if (!s) return setErr("Symbol is required");
    if (!c) return setErr("Company name is required");
    if (isNaN(e)) return setErr("Enter a valid expected % (e.g. 4.5 or -2)");
    if (!pickedDate) return setErr("Pick a date");
    if (taken.some(t => t.symbol === s && t.pickedDate === pickedDate)) return setErr(`${s} is already tracked for ${pickedDate}`);
    onAdd({ id:Date.now(), symbol:s, company:c, expectedPct:e, pickedDate });
  };

  const inp = { width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, color:T.text, padding:"11px 14px", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", boxSizing:"border-box", transition:"border-color 0.15s", colorScheme: T.isDark ? "dark" : "light" };
  const F = ({ label, children }) => (
    <div>
      <label style={{ display:"block", fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", marginBottom:7 }}>{label}</label>
      {children}
    </div>
  );
  const expVal = parseFloat(expected);
  const hasExp = !isNaN(expVal);

  return (
    <div onClick={e => e.target===e.currentTarget&&onClose()} style={{ position:"fixed", inset:0, background:"#00000090", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:18, padding:"32px 28px", width:"min(440px,100%)", boxShadow:"0 32px 80px #00000040", animation:"up 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:26 }}>
          <div>
            <h3 style={{ margin:0, fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.text }}>New Pick</h3>
            <p style={{ margin:"4px 0 0", fontSize:12, color:T.muted }}>Tracked for 5 days from picked date</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:22 }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="SYMBOL *">
              <input value={symbol} onChange={e=>{setSymbol(e.target.value);setErr("");}} placeholder="e.g. VWELX" style={inp}
                onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} onKeyDown={e=>e.key==="Enter"&&submit()} />
            </F>
            <F label="PICKED DATE *">
              <input type="date" value={pickedDate} onChange={e=>{setDate(e.target.value);setErr("");}} style={inp}
                onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} />
            </F>
          </div>
          <F label="COMPANY / FUND NAME *">
            <input value={company} onChange={e=>{setCompany(e.target.value);setErr("");}} placeholder="e.g. Vanguard Wellington Fund" style={inp}
              onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </F>
          <F label="EXPECTED % CHANGE (5 DAYS) *">
            <input type="number" value={expected} onChange={e=>{setExpected(e.target.value);setErr("");}} placeholder="e.g. 4.5 or -2" style={inp}
              onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.border} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </F>
        </div>
        {err && <p style={{ color:T.red, fontSize:12, margin:"12px 0 0", fontFamily:"'DM Mono',monospace" }}>⚠ {err}</p>}
        {hasExp && (
          <div style={{ marginTop:14, padding:"10px 14px", borderRadius:9, background:expVal>=0?T.green+"15":T.red+"15", border:`1px solid ${expVal>=0?T.green:T.red}30`, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>{expVal>=0?"📈":"📉"}</span>
            <span style={{ fontSize:12, color:T.muted }}>Expecting <span style={{ color:expVal>=0?T.green:T.red, fontWeight:600 }}>{expVal>=0?"+":""}{expVal}%</span> · End: <b style={{ color:T.text }}>{pickedDate?addDays(pickedDate,5):"—"}</b></span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={onClose} style={{ flex:1, padding:12, background:"none", border:`1px solid ${T.border}`, borderRadius:9, color:T.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13 }}>Cancel</button>
          <button onClick={submit} style={{ flex:2, padding:12, background:T.green, border:"none", borderRadius:9, color:T.isDark?"#060A10":"#fff", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:800, boxShadow:`0 0 20px ${T.green}40` }}>Add to Tracker →</button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ pick, colorIdx, onClose, onRemove }) {
  const T = useT();
  const color   = col(colorIdx);
  const elapsed = Math.min(daysSince(pick.pickedDate), 5);
  const allData = getDayData(pick.symbol, pick.expectedPct);
  const visible = allData.slice(0, elapsed+1);
  const current = visible[visible.length-1]?.cum ?? 0;
  const isComplete = elapsed >= 5;
  const hit     = calcHitTarget(pick);
  const endDate = addDays(pick.pickedDate, 5);

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed", inset:0, background:"#00000090", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:20, padding:"30px 28px", width:"min(580px,100%)", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px #00000040", animation:"up 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ width:4, height:52, background:color, borderRadius:2 }} />
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:600, color }}>{pick.symbol}</span>
                <HitBadge hit={hit} />
                {!isComplete && <Pill color={T.blue} filled>Day {elapsed}/5</Pill>}
              </div>
              <div style={{ fontSize:13, color:T.muted }}>{pick.company}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:22 }}>×</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
          {[
            { label:"Picked",   v:<span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:T.text }}>{pick.pickedDate}</span> },
            { label:"End Date", v:<span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:isComplete?T.mutedLight:T.amber }}>{endDate}</span> },
            { label:"Expected", v:<Pct v={pick.expectedPct} /> },
            { label:"Current",  v:<Pct v={current} /> },
          ].map(s => (
            <div key={s.label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 12px" }}>
              <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", marginBottom:8 }}>{s.label.toUpperCase()}</div>
              {s.v}
            </div>
          ))}
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 12px 8px", marginBottom:16 }}>
          <p style={{ margin:"0 0 12px 6px", fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.1em" }}>CUMULATIVE RETURN · ACTUAL vs TARGET</p>
          <ResponsiveContainer width="100%" height={165}>
            <LineChart data={allData} margin={{ top:4, right:24, left:0, bottom:0 }}>
              <XAxis dataKey="label" tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={{ stroke:T.border }} tickLine={false} />
              <YAxis tickFormatter={v=>`${v>=0?"+":""}${v.toFixed(1)}%`} tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<TTip />} />
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
              <ReferenceLine y={pick.expectedPct} stroke={color} strokeDasharray="6 4" strokeOpacity={0.35}
                label={{ value:`Target ${pick.expectedPct>0?"+":""}${pick.expectedPct}%`, position:"insideTopRight", fill:color, fontSize:9, fontFamily:"'DM Mono',monospace" }} />
              <Line type="monotone" dataKey="cum" data={visible} name={pick.symbol} stroke={color} strokeWidth={2.5} dot={{ r:3, fill:color, strokeWidth:0 }} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, marginBottom:18 }}>
          {allData.map((d,i) => {
            const reached = i <= elapsed;
            const pos = d.cum >= 0;
            return (
              <div key={i} style={{ background:reached?(pos?T.green+"12":T.red+"12"):T.surface, border:`1px solid ${reached?(pos?T.green+"35":T.red+"35"):T.border}`, borderRadius:8, padding:"10px 6px", textAlign:"center", opacity:reached?1:0.4 }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", marginBottom:6 }}>{d.label}</div>
                <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:600, color:pos?T.green:T.red }}>{reached?`${d.cum>=0?"+":""}${d.cum.toFixed(2)}%`:"–"}</div>
                {i>0&&reached&&<div style={{ fontSize:9, color:T.muted, marginTop:3, fontFamily:"'DM Mono',monospace" }}>{d.daily>=0?"▲":"▼"}{Math.abs(d.daily).toFixed(2)}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.muted, fontFamily:"'DM Mono',monospace" }}>Picked {pick.pickedDate} · Ends {endDate}</span>
          <button onClick={()=>{onRemove(pick.id);onClose();}} style={{ background:T.red+"15", border:`1px solid ${T.red}30`, color:T.red, borderRadius:8, padding:"7px 16px", cursor:"pointer", fontSize:11, fontFamily:"'DM Mono',monospace" }}>Remove Pick</button>
        </div>
      </div>
    </div>
  );
}

// ── Fund Card ─────────────────────────────────────────────────────────────────
function FundCard({ pick, colorIdx, onClick }) {
  const T = useT();
  const color   = col(colorIdx);
  const elapsed = Math.min(daysSince(pick.pickedDate), 5);
  const data    = getDayData(pick.symbol, pick.expectedPct);
  const visible = data.slice(0, elapsed+1);
  const current = visible[visible.length-1]?.cum ?? 0;
  const isComplete = elapsed >= 5;
  const hit     = calcHitTarget(pick);
  const onTrack = pick.expectedPct > 0 ? current > 0 : pick.expectedPct < 0 ? current < 0 : true;
  const endDate = addDays(pick.pickedDate, 5);

  return (
    <div onClick={onClick}
      style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px", cursor:"pointer", position:"relative", overflow:"hidden", transition:"all 0.2s", boxShadow: T.isDark ? "none" : "0 2px 12px rgba(0,0,0,0.06)" }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=color+"60"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=`0 10px 36px ${color}22`; e.currentTarget.style.background=T.surfaceHover; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=T.isDark?"none":"0 2px 12px rgba(0,0,0,0.06)"; e.currentTarget.style.background=T.surface; }}
    >
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color, borderRadius:"14px 14px 0 0" }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={{ flex:1, minWidth:0, marginRight:8 }}>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:600, color, marginBottom:3 }}>{pick.symbol}</div>
          <div style={{ fontSize:11, color:T.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pick.company}</div>
        </div>
        <Pct v={current} size={12} />
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
        <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>📅 {pick.pickedDate}</span>
        <span style={{ fontSize:10, color:T.textDim }}>→</span>
        <span style={{ fontSize:10, fontFamily:"'DM Mono',monospace", color:isComplete?T.mutedLight:T.amber }}>{endDate}</span>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:11, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>Target:</span>
        <Pct v={pick.expectedPct} size={10} />
        <HitBadge hit={hit} />
        {!isComplete&&elapsed>0&&<Pill color={onTrack?T.green:T.red} filled>{onTrack?"On Track":"Off Track"}</Pill>}
      </div>
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={visible} margin={{ top:2, right:0, left:0, bottom:0 }}>
          <defs>
            <linearGradient id={`g${colorIdx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3" />
          <Area type="monotone" dataKey="cum" stroke={color} strokeWidth={1.5} fill={`url(#g${colorIdx})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ marginTop:10, marginBottom:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{isComplete?"COMPLETED":`DAY ${elapsed} OF 5`}</span>
          <span style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{elapsed}/5</span>
        </div>
        <ProgressBar value={elapsed} color={isComplete?(hit===true?T.green:hit===false?T.red:T.muted):color} />
      </div>
      <div style={{ display:"flex", gap:3 }}>
        {[1,2,3,4,5].map(d => {
          const reached = d <= elapsed;
          const pos = (data[d]?.cum??0) >= 0;
          return (
            <div key={d} style={{ flex:1, height:18, borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", background:reached?(pos?T.green+"18":T.red+"18"):T.border, border:`1px solid ${reached?(pos?T.green+"40":T.red+"40"):"transparent"}` }}>
              <span style={{ fontSize:8, fontFamily:"'DM Mono',monospace", color:reached?(pos?T.green:T.red):T.muted }}>D{d}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:8, textAlign:"right" }}>
        <span style={{ fontSize:9, color:color, fontFamily:"'DM Mono',monospace", opacity:0.7 }}>View details →</span>
      </div>
    </div>
  );
}

// ── Tracking Table ────────────────────────────────────────────────────────────
function TrackingTable({ picks, onRowClick }) {
  const T = useT();
  const [sort, setSort] = useState({ key:"pickedDate", dir:-1 });

  const cols = [
    { key:"symbol",     label:"Symbol",      w:"90px"  },
    { key:"company",    label:"Fund Name",   w:"auto"  },
    { key:"pickedDate", label:"Picked",      w:"110px" },
    { key:"endDate",    label:"End Date",    w:"110px" },
    { key:"expected",   label:"Expected",    w:"95px"  },
    { key:"current",    label:"Current",     w:"95px"  },
    { key:"d1",         label:"D1",          w:"66px"  },
    { key:"d2",         label:"D2",          w:"66px"  },
    { key:"d3",         label:"D3",          w:"66px"  },
    { key:"d4",         label:"D4",          w:"66px"  },
    { key:"d5",         label:"D5 Final",    w:"80px"  },
    { key:"hit",        label:"Hit Target?", w:"105px" },
    { key:"status",     label:"Status",      w:"85px"  },
  ];

  const rows = picks.map(pick => {
    const data = getDayData(pick.symbol, pick.expectedPct);
    const elapsed = daysSince(pick.pickedDate);
    const current = data[Math.min(elapsed,5)].cum;
    const hit = calcHitTarget(pick);
    const isComplete = elapsed >= 5;
    return {
      pick, symbol:pick.symbol, company:pick.company,
      pickedDate:pick.pickedDate, endDate:addDays(pick.pickedDate,5),
      expected:pick.expectedPct, current,
      d1:elapsed>=1?data[1].cum:null, d2:elapsed>=2?data[2].cum:null,
      d3:elapsed>=3?data[3].cum:null, d4:elapsed>=4?data[4].cum:null,
      d5:elapsed>=5?data[5].cum:null,
      hit, status:isComplete?"Done":`Day ${Math.min(elapsed,5)}`, isComplete, elapsed,
    };
  });

  const sorted = [...rows].sort((a,b) => {
    let av=a[sort.key], bv=b[sort.key];
    if (av===null) av=-Infinity; if (bv===null) bv=-Infinity;
    if (sort.key==="hit") { av=av===null?0:av?1:-1; bv=bv===null?0:bv?1:-1; }
    return av<bv?-sort.dir:av>bv?sort.dir:0;
  });

  const toggleSort = key => setSort(s => ({ key, dir:s.key===key?-s.dir:-1 }));
  const arrow = key => sort.key===key?(sort.dir===-1?" ↓":" ↑"):"";

  const PctCell = ({ v }) => {
    if (v===null) return <span style={{ color:T.border, fontFamily:"'DM Mono',monospace", fontSize:11 }}>—</span>;
    const pos = v >= 0;
    return <span style={{ color:pos?T.green:T.red, fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:500 }}>{pos?"+":""}{v.toFixed(2)}%</span>;
  };

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", boxShadow:T.isDark?"none":"0 2px 16px rgba(0,0,0,0.07)" }}>
      <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h3 style={{ margin:0, fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:T.text }}>All Tracked Funds</h3>
          <p style={{ margin:"3px 0 0", fontSize:11, color:T.muted }}>{picks.length} funds · click any row to view details · click column headers to sort</p>
        </div>
        <span style={{ fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace" }}>{picks.filter(p=>daysSince(p.pickedDate)>=5).length} completed · {picks.filter(p=>daysSince(p.pickedDate)<5).length} active</span>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:960 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} onClick={()=>toggleSort(c.key)} style={{ padding:"11px 12px", textAlign:"left", fontSize:9, fontFamily:"'DM Mono',monospace", color:sort.key===c.key?T.blue:T.muted, letterSpacing:"0.1em", whiteSpace:"nowrap", cursor:"pointer", userSelect:"none", borderBottom:`1px solid ${T.border}`, background:T.bgTableHead, position:"sticky", top:0, zIndex:2, width:c.w, transition:"color 0.15s" }}>
                  {c.label}{arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const color = col(picks.indexOf(row.pick));
              return (
                <tr key={row.pick.id} onClick={()=>onRowClick(row.pick)}
                  style={{ borderBottom:`1px solid ${T.border}`, cursor:"pointer", transition:"background 0.12s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >
                  <td style={{ padding:"13px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:3, height:28, background:color, borderRadius:2, flexShrink:0 }} />
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, color }}>{row.symbol}</span>
                    </div>
                  </td>
                  <td style={{ padding:"13px 12px" }}><span style={{ fontSize:12, color:T.textDim, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:220, display:"block" }}>{row.company}</span></td>
                  <td style={{ padding:"13px 12px" }}><span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:T.text }}>{fmtDate(row.pickedDate)}</span></td>
                  <td style={{ padding:"13px 12px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:row.isComplete?T.muted:T.amber }}>{fmtDate(row.endDate)}</span>
                      <span style={{ fontSize:9, color:row.isComplete?T.muted:T.amber, fontFamily:"'DM Mono',monospace" }}>{row.isComplete?"Closed":`${5-row.elapsed}d left`}</span>
                    </div>
                  </td>
                  <td style={{ padding:"13px 12px" }}><Pct v={row.expected} size={11} /></td>
                  <td style={{ padding:"13px 12px" }}><Pct v={row.current} size={11} /></td>
                  {[row.d1,row.d2,row.d3,row.d4,row.d5].map((v,di) => (
                    <td key={di} style={{ padding:"13px 8px" }}><PctCell v={v} /></td>
                  ))}
                  <td style={{ padding:"13px 12px" }}><HitBadge hit={row.hit} /></td>
                  <td style={{ padding:"13px 12px" }}><Pill color={row.isComplete?T.muted:T.blue} filled>{row.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [picks, setPicks]       = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [detail, setDetail]     = useState(null);
  const [cardFilter, setFilter] = useState("all");
  const [ready, setReady]       = useState(false);
  const [saved, setSaved]       = useState(false);
  const [exporting, setExp]     = useState(false);
  const [isDark, setIsDark]     = useState(true);

  const T = isDark ? DARK : LIGHT;

  useEffect(() => {
    Promise.all([loadStorage(), loadTheme()]).then(([stored, thm]) => {
      setPicks(stored ?? makeDemoData());
      setIsDark(thm !== "light");
      setTimeout(() => setReady(true), 60);
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    saveTheme(next ? "dark" : "light");
  };

  const persist = useCallback(async p => {
    await saveStorage(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const addPick   = p  => { const u=[p,...picks]; setPicks(u); persist(u); setShowAdd(false); };
  const removePick = id => { const u=picks.filter(p=>p.id!==id); setPicks(u); persist(u); };

  const handleExport = async () => {
    setExp(true);
    try { await exportToExcel(picks); } catch(e) { alert("Export failed: "+e.message); }
    finally { setExp(false); }
  };

  if (!picks) return (
    <ThemeCtx.Provider value={T}>
      <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
        <span style={{ color:T.muted, fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading…</span>
      </div>
    </ThemeCtx.Provider>
  );

  const active    = picks.filter(p => daysSince(p.pickedDate) < 5);
  const completed = picks.filter(p => daysSince(p.pickedDate) >= 5);
  const hitCount  = completed.filter(p => calcHitTarget(p)===true).length;
  const hitRate   = completed.length > 0 ? Math.round((hitCount/completed.length)*100) : null;
  const shownCards = cardFilter==="active" ? active : cardFilter==="completed" ? completed : picks;

  const overlayData = active.length > 0
    ? [0,1,2,3,4,5].map(d => {
        const pt = { label: d===0?"D0":`D${d}` };
        active.forEach(p => { pt[`${p.symbol}_${p.id}`] = getDayData(p.symbol,p.expectedPct)[d]?.cum??null; });
        return pt;
      })
    : [];

  return (
    <ThemeCtx.Provider value={T}>
      <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Sans',sans-serif", transition:"background 0.3s, color 0.3s" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", backgroundImage:`linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize:"44px 44px", transition:"background-image 0.3s" }} />

        <div style={{ maxWidth:1220, margin:"0 auto", padding:"40px 20px", position:"relative" }}>

          {/* ── Header ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, opacity:ready?1:0, transform:ready?"none":"translateY(-14px)", transition:"all 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:T.green, boxShadow:`0 0 10px ${T.green}`, animation:"blink 2s infinite" }} />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:T.green, letterSpacing:"0.18em" }}>MF PICK TRACKER</span>
                {saved && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:T.muted }}>· ✓ saved</span>}
              </div>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(24px,3.5vw,38px)", fontWeight:800, margin:0, letterSpacing:"-0.025em", color:T.text }}>
                Fund <span style={{ color:T.green }}>Performance</span>
              </h1>
              <p style={{ color:T.muted, fontSize:13, margin:"6px 0 0", fontWeight:300 }}>
                {picks.length} picks · {active.length} active · {completed.length} completed{hitRate!==null?` · ${hitRate}% hit rate`:""}
              </p>
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"flex-end", alignItems:"center" }}>
              <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
              {picks.length > 0 && (
                <button onClick={handleExport} disabled={exporting}
                  style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${T.amber}50`, borderRadius:11, color:T.amber, cursor:exporting?"wait":"pointer", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", gap:7, opacity:exporting?0.6:1, transition:"all 0.2s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.amber+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >⬇ Export Excel</button>
              )}
              <button onClick={()=>setShowAdd(true)} style={{ background:T.green, border:"none", borderRadius:11, color:T.isDark?"#060A10":"#fff", padding:"12px 22px", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:13, display:"flex", alignItems:"center", gap:8, boxShadow:`0 0 28px ${T.green}35` }}>
                <span style={{ fontSize:20, lineHeight:1 }}>+</span> Add Pick
              </button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))", gap:12, marginBottom:24, opacity:ready?1:0, transform:ready?"none":"translateY(12px)", transition:"all 0.5s cubic-bezier(0.16,1,0.3,1) 0.07s" }}>
            {[
              { label:"Total Picks",  v:picks.length,     color:T.text },
              { label:"Active",       v:active.length,    color:T.blue },
              { label:"Completed",    v:completed.length, color:T.mutedLight },
              { label:"Hit Rate",     v:hitRate!==null?`${hitRate}%`:"–", color:hitRate!==null?(hitRate>=60?T.green:T.red):T.muted },
              { label:"Hits",         v:hitCount,          color:T.green },
              { label:"Avg Return",   v:completed.length?(() => { const avg=completed.reduce((s,p)=>s+getDayData(p.symbol,p.expectedPct)[5].cum,0)/completed.length; return <Pct v={avg} size={14} />; })():<span style={{ color:T.muted, fontFamily:"'DM Mono',monospace" }}>–</span> },
            ].map((s,i) => (
              <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"15px 17px", boxShadow:T.isDark?"none":"0 1px 8px rgba(0,0,0,0.05)", transition:"background 0.3s, border-color 0.3s" }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", marginBottom:10 }}>{s.label.toUpperCase()}</div>
                <div style={{ fontSize:21, fontFamily:"'Syne',sans-serif", fontWeight:700, color:s.color||T.text }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* ── Overlay chart ── */}
          {active.length > 0 && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"20px 18px 14px", marginBottom:24, opacity:ready?1:0, transition:"opacity 0.5s ease 0.12s, background 0.3s", boxShadow:T.isDark?"none":"0 2px 16px rgba(0,0,0,0.06)" }}>
              <p style={{ margin:"0 0 14px 4px", fontSize:10, color:T.muted, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em" }}>ACTIVE PICKS · CUMULATIVE RETURN</p>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={overlayData} margin={{ top:4, right:16, left:0, bottom:0 }}>
                  <XAxis dataKey="label" tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={{ stroke:T.border }} tickLine={false} />
                  <YAxis tickFormatter={v=>`${v>=0?"+":""}${v.toFixed(1)}%`} tick={{ fill:T.muted, fontSize:10, fontFamily:"'DM Mono',monospace" }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<TTip />} />
                  <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
                  {active.map(p => (
                    <Line key={p.id} type="monotone" dataKey={`${p.symbol}_${p.id}`} name={`${p.symbol} (${p.pickedDate})`}
                      stroke={col(picks.indexOf(p))} strokeWidth={2}
                      dot={{ r:3, fill:col(picks.indexOf(p)), strokeWidth:0 }} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:8 }}>
                {active.map(p => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }} onClick={()=>setDetail(p)}>
                    <div style={{ width:12, height:3, borderRadius:2, background:col(picks.indexOf(p)) }} />
                    <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:col(picks.indexOf(p)) }}>{p.symbol}</span>
                    <span style={{ fontSize:10, color:T.muted }}>{p.pickedDate} · D{daysSince(p.pickedDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Filter tabs ── */}
          <div style={{ display:"flex", gap:6, marginBottom:16 }}>
            {[["all","All Cards"],["active","Active"],["completed","Completed"]].map(([v,l]) => (
              <button key={v} onClick={()=>setFilter(v)} style={{
                padding:"7px 16px", borderRadius:8, cursor:"pointer",
                border:cardFilter===v?`1px solid ${T.green}50`:`1px solid ${T.border}`,
                background:cardFilter===v?T.green+"14":"transparent",
                color:cardFilter===v?T.green:T.muted,
                fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"0.08em", transition:"all 0.15s",
              }}>{l.toUpperCase()}</button>
            ))}
          </div>

          {/* ── Cards ── */}
          {shownCards.length===0 ? (
            <div style={{ border:`2px dashed ${T.border}`, borderRadius:16, padding:"48px 20px", textAlign:"center", color:T.muted, marginBottom:36 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:6, color:T.text }}>No picks here</div>
              <div style={{ fontSize:13 }}>Hit <b style={{ color:T.green }}>+ Add Pick</b> to start tracking</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))", gap:14, marginBottom:36 }}>
              {shownCards.map(pick => (
                <FundCard key={pick.id} pick={pick} colorIdx={picks.indexOf(pick)} onClick={()=>setDetail(pick)} />
              ))}
            </div>
          )}

          {/* ── Table ── */}
          {picks.length > 0 && (
            <div style={{ opacity:ready?1:0, transition:"opacity 0.5s ease 0.2s" }}>
              <TrackingTable picks={picks} onRowClick={p=>setDetail(p)} />
            </div>
          )}
        </div>

        {showAdd && <AddModal onAdd={addPick} onClose={()=>setShowAdd(false)} taken={picks} />}
        {detail && <DetailModal pick={detail} colorIdx={picks.indexOf(detail)} onClose={()=>setDetail(null)} onRemove={removePick} />}

        <style>{`
          @keyframes up { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;} }
          @keyframes blink { 0%,100%{opacity:1;}50%{opacity:0.25;} }
          * { box-sizing:border-box; }
          ::-webkit-scrollbar { width:5px; height:5px; }
          ::-webkit-scrollbar-track { background:${T.scrollTrack}; }
          ::-webkit-scrollbar-thumb { background:${T.scrollThumb}; border-radius:3px; }
          input[type=date]::-webkit-calendar-picker-indicator { filter:${T.calIcon}; }
        `}</style>
      </div>
    </ThemeCtx.Provider>
  );
}
