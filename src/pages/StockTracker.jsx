import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const DARK = {
  bg:"#060A10",bgModal:"#0B111C",bgTableHead:"#080E19",
  surface:"rgba(255,255,255,0.025)",surfaceHover:"rgba(255,255,255,0.045)",
  border:"#1A2235",muted:"#7A8FA8",mutedLight:"#8A9FBA",
  text:"#B8C8D8",textDim:"#90A8C0",
  green:"#05D48A",red:"#F05A5A",blue:"#4B9EFF",amber:"#F5A524",
  gridLine:"rgba(26,34,53,0.5)",tooltipBg:"#0B111C",
  scrollTrack:"#060A10",scrollThumb:"#1A2235",
  calIcon:"invert(0.5)",toggleBg:"#1A2235",toggleKnob:"#4A5568",isDark:true,
};
const LIGHT = {
  bg:"#EEF2FF",bgModal:"#FFFFFF",bgTableHead:"#E8EDFA",
  surface:"#FFFFFF",surfaceHover:"#F4F7FF",
  border:"#C5D0E8",muted:"#0A111E",mutedLight:"#172030",
  text:"#060A10",textDim:"#0D1828",
  green:"#00A86B",red:"#D92B2B",blue:"#1A5FCC",amber:"#C47A00",
  gridLine:"rgba(165,182,220,0.35)",tooltipBg:"#FFFFFF",
  scrollTrack:"#EEF2FF",scrollThumb:"#C5D0E8",
  calIcon:"invert(0)",toggleBg:"#C5D0E8",toggleKnob:"#FFFFFF",isDark:false,
};
const ThemeCtx = createContext(DARK);
const useT = () => useContext(ThemeCtx);
const PALETTE = ["#05D48A","#4B9EFF","#F5A524","#C97EFF","#FF6F91","#00C9E0","#FF9A3C","#A8FF3E"];
const col = i => PALETTE[i % PALETTE.length];

const KEY="stock-tracker-v1", KEY_MANUAL="stock-tracker-manual", KEY_THM="stock-tracker-theme";
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxBZIBKh66CnLxqNvhKwn083Z5p_Shbtfj7Cn4B9s1enO5_JuQD_XjtddCGPhTMdB5f/exec";

async function saveStorage(data){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}}
async function loadPriceCache(){try{const v=localStorage.getItem(KEY);return v?JSON.parse(v):[];}catch{return[];}}
async function saveManualPicks(p){try{localStorage.setItem(KEY_MANUAL,JSON.stringify(p));}catch{}}
async function loadManualPicks(){try{const v=localStorage.getItem(KEY_MANUAL);return v?JSON.parse(v):[];}catch{return[];}}
async function loadTheme(){try{return localStorage.getItem(KEY_THM)||"dark";}catch{return"dark";}}
async function saveTheme(v){try{localStorage.setItem(KEY_THM,v);}catch{}}

function dateToStr(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function todayStr(){return dateToStr(new Date());}

function getMarketHolidays(year){
  const holidays=new Set();
  const fmt=d=>dateToStr(d);
  const nthWeekday=(y,m,weekday,n)=>{const d=new Date(y,m-1,1);let count=0;while(true){if(d.getDay()===weekday){count++;if(count===n)return new Date(d);}d.setDate(d.getDate()+1);}};
  const lastWeekday=(y,m,weekday)=>{const d=new Date(y,m,0);while(d.getDay()!==weekday)d.setDate(d.getDate()-1);return new Date(d);};
  const observe=d=>{const day=d.getDay();if(day===0){const n=new Date(d);n.setDate(d.getDate()+1);return n;}if(day===6){const n=new Date(d);n.setDate(d.getDate()-1);return n;}return d;};
  function getEaster(y){const a=y%19,b=Math.floor(y/100),c=y%100,dv=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-dv-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(y,month-1,day);}
  holidays.add(fmt(observe(new Date(year,0,1))));
  holidays.add(fmt(nthWeekday(year,1,1,3)));
  holidays.add(fmt(nthWeekday(year,2,1,3)));
  const easter=getEaster(year);const gf=new Date(easter);gf.setDate(easter.getDate()-2);holidays.add(fmt(gf));
  holidays.add(fmt(lastWeekday(year,5,1)));
  if(year>=2022)holidays.add(fmt(observe(new Date(year,5,19))));
  holidays.add(fmt(observe(new Date(year,6,4))));
  holidays.add(fmt(nthWeekday(year,9,1,1)));
  holidays.add(fmt(observe(new Date(year,10,11))));
  holidays.add(fmt(nthWeekday(year,11,4,4)));
  holidays.add(fmt(observe(new Date(year,11,25))));
  return holidays;
}
const _hCache={};
function isMarketHoliday(s){const y=parseInt(s.slice(0,4));if(!_hCache[y])_hCache[y]=getMarketHolidays(y);return _hCache[y].has(s);}
function isMarketOpen(s){const d=new Date(s+"T12:00:00");if(d.getDay()===0||d.getDay()===6)return false;return!isMarketHoliday(s);}
function addTradingDays(dateStr,n){const d=new Date(dateStr+"T12:00:00");let c=0;while(c<n){d.setDate(d.getDate()+1);if(isMarketOpen(dateToStr(d)))c++;}return dateToStr(d);}
function tradingDaysSince(dateStr){
  const start=new Date(dateStr+"T12:00:00");const today=new Date();today.setHours(0,0,0,0);
  if(today<=start)return 0;let count=0;const cur=new Date(start);
  // Use >= so today itself is never counted — only strictly past trading days
  while(true){cur.setDate(cur.getDate()+1);const curDay=new Date(cur);curDay.setHours(0,0,0,0);if(curDay>=today)break;if(isMarketOpen(dateToStr(cur)))count++;if(count>=5)break;}
  return count;
}
function getTradingDayDates(dateStr){const result=[];let cur=dateStr;for(let i=1;i<=5;i++){cur=addTradingDays(cur,1);result.push({tradingDay:i,date:cur});}return result;}

// ── Pick logic ────────────────────────────────────────────────────────────────
function buildDayData(pick){
  const p=pick.prices||{};const base=p.baseNav;
  const pts=[{day:0,label:"Day 0",cum:0,daily:0,price:base||null}];
  if(!base)return pts;
  for(let d=1;d<=5;d++){
    const nav=p[`d${d}`];if(nav==null)break;
    const cum=+((nav-base)/base*100).toFixed(3);
    const prev=d===1?base:(p[`d${d-1}`]??base);
    const daily=+((nav-prev)/prev*100).toFixed(3);
    pts.push({day:d,label:`Day ${d}`,cum,daily,price:nav});
  }
  return pts;
}

function calcHitTarget(pick){
  const elapsed=tradingDaysSince(pick.pickedDate);
  if(elapsed<1)return null;
  const data=buildDayData(pick);
  if(data.length<2)return null;

  const base=pick.prices?.baseNav;
  let effectiveTarget=pick.targetPrice||null;
  if(!effectiveTarget&&pick.expectedPct&&base){
    effectiveTarget=+(base*(1+pick.expectedPct/100)).toFixed(4);
  }

  const isComplete=elapsed>=5;

  if(effectiveTarget&&base){
    const isLong=effectiveTarget>=base;
    // Check D1–D5 using intraday HIGH (bullish) or LOW (bearish)
    // Falls back to close price if high/low not available
    const days=data.slice(1);
    const hit=days.some((d,i)=>{
      const dayNum=i+1;
      if(d.price==null)return false;
      if(isLong){
        // Use intraday high — if available it's more accurate than close
        const high=pick.prices?.[`d${dayNum}High`]??d.price;
        return high>=effectiveTarget;
      }else{
        const low=pick.prices?.[`d${dayNum}Low`]??d.price;
        return low<=effectiveTarget;
      }
    });
    if(hit)return true;
    return isComplete?false:null;
  }

  // Fallback: % only
  const target=pick.expectedPct||0;
  const days=data.slice(1);
  const hitPct=target>0
    ?days.some(d=>d.cum>=target)
    :target<0?days.some(d=>d.cum<=target)
    :false;
  if(hitPct)return true;
  return isComplete?false:null;
}

// Compute effective target price for display
function effectiveTargetPrice(pick){
  if(pick.targetPrice)return pick.targetPrice;
  const base=pick.prices?.baseNav;
  if(pick.expectedPct&&base)return+(base*(1+pick.expectedPct/100)).toFixed(4);
  return null;
}

function targetPriceAsPct(pick){
  const tp=effectiveTargetPrice(pick);
  if(!tp||!pick.prices?.baseNav)return null;
  return+((tp-pick.prices.baseNav)/pick.prices.baseNav*100).toFixed(2);
}
function getTargetPct(pick){
  const base=pick.prices?.baseNav;
  const tp=effectiveTargetPrice(pick);
  if(tp&&base)return+((tp-base)/base*100).toFixed(2);
  return pick.expectedPct||null;
}

// ── Peak stats: highest intraday price + max % change over D1–D5 ─────────────
function getPickPeakStats(pick){
  const p=pick.prices;if(!p?.baseNav)return{peakPrice:null,peakPct:null,peakDay:null};
  const base=p.baseNav;
  let peakPrice=null,peakPct=null,peakDay=null;
  for(let d=1;d<=5;d++){
    const high=p[`d${d}High`];
    const close=p[`d${d}`];
    // Use intraday high if available, else close
    const candidate=high??close;
    if(candidate==null)continue;
    const pct=+((candidate-base)/base*100).toFixed(2);
    if(peakPct===null||pct>peakPct){peakPct=pct;peakPrice=candidate;peakDay=d;}
  }
  return{peakPrice,peakPct,peakDay};
}

// ── Sheet fetch ───────────────────────────────────────────────────────────────
async function fetchSheetPicks(){
  if(!SHEET_API_URL||SHEET_API_URL==="YOUR_GOOGLE_APPS_SCRIPT_URL_HERE")return[];
  let json;
  try{const r=await fetch(`/api/sheet?url=${encodeURIComponent(SHEET_API_URL)}`,{signal:AbortSignal.timeout(15000)});if(r.ok){const d=await r.json();if(!d.error)json=d;}}catch{}
  if(!json){try{const r=await fetch(SHEET_API_URL,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);json=await r.json();}catch(e){throw new Error(`Cannot reach sheet: ${e.message}`);}}
  let rows=[];
  if(Array.isArray(json))rows=json;
  else if(Array.isArray(json.picks))rows=json.picks;
  else if(Array.isArray(json.data))rows=json.data;
  else{const fa=Object.values(json).find(v=>Array.isArray(v));if(fa)rows=fa;}
  if(rows.length===0)throw new Error("Sheet returned 0 rows.");

  const getField=(row,...names)=>{for(const name of names){for(const key of Object.keys(row)){if(key.trim().toLowerCase()===name.toLowerCase()){const val=row[key];if(val!==undefined&&val!==null&&val!=="")return val;}}}return"";};
  const toDS=(val)=>{
    if(!val)return"";
    if(typeof val==="string"&&/^\d{4}-\d{2}-\d{2}/.test(val))return val.slice(0,10);
    if(typeof val==="string"){const d=new Date(val.includes("T")?val:val+"T12:00:00");if(!isNaN(d))return dateToStr(d);}
    if(typeof val==="number"){const d=new Date((val-25569)*86400*1000);if(!isNaN(d))return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");}
    return String(val).slice(0,10);
  };

  const picks=rows.map((sp,i)=>{
    // Apps Script returns these exact keys: ticker, company, eventDate,
    // targetPrice, expectedPct, confidence, link, reasoning
    // Also handle raw Google Form column names as fallback
    const ticker=String(getField(sp,"ticker","Ticker","Symbol","symbol")).toUpperCase().trim();
    const company=String(getField(sp,"company","Company Name","Company","name")).trim();
    // Apps Script returns "pickDate" — also handle raw column names as fallback
    const rawDate=toDS(getField(sp,"pickDate","Pick Date","pick_date","pickedDate","Event Date","eventDate","Date","date"));
    const link=String(getField(sp,"link","Link","URL","url")||"").trim();
    const confidence=String(getField(sp,"confidence","Confidence")||"").trim();
    const reasoning=String(getField(sp,"reasoning","2-Line Reasoning","Reasoning","Reason","Notes")||"").trim();

    // targetPrice — Apps Script already strips $ and converts to number
    const rawPrice=String(getField(sp,"targetPrice","Target Price","target_price","price")||"").replace(/[$,]/g,"").trim();
    const targetPrice=parseFloat(rawPrice)||null;

    // expectedPct — Apps Script already handles decimal conversion
    const rawExp=String(getField(sp,"expectedPct","Expected %","Expected","expected","Target %")||"0").replace("%","").trim();
    const expNum=parseFloat(rawExp)||0;
    const expectedPct=Math.abs(expNum)>0&&Math.abs(expNum)<1?expNum*100:expNum;

    // Weekend → back to previous Friday
    const pdObj=new Date((rawDate||todayStr())+"T12:00:00");
    if(pdObj.getDay()===6)pdObj.setDate(pdObj.getDate()-1);
    if(pdObj.getDay()===0)pdObj.setDate(pdObj.getDate()-2);
    const adj=pdObj.getFullYear()+"-"+String(pdObj.getMonth()+1).padStart(2,"0")+"-"+String(pdObj.getDate()).padStart(2,"0");
    return{id:`sheet-${ticker}-${adj}`,symbol:ticker,company,pickedDate:adj,targetPrice,expectedPct,link,confidence,reasoning,_source:"sheet"};
  });

  const latest={};picks.forEach(p=>{if(p.symbol&&p.pickedDate)latest[p.symbol+"|"+p.pickedDate]=p;});
  const valid=Object.values(latest).filter(p=>p.symbol&&p.pickedDate?.length===10);
  if(valid.length===0)throw new Error("0 valid picks. Check your Apps Script is deployed and sheet has columns: Ticker, Company Name, Event Date, Target Price, Expected %, Confidence, Link, 2-Line Reasoning");
  return valid;
}

function mergePicks(sheetPicks,manualPicks,priceCache){
  const all=[...sheetPicks];
  manualPicks.forEach(mp=>{if(!all.some(p=>p.symbol===mp.symbol&&p.pickedDate===mp.pickedDate))all.push({...mp,_source:"manual"});});
  return all.map(pick=>{
    const cached=priceCache.find(c=>c.id===pick.id||(c.symbol===pick.symbol&&c.pickedDate===pick.pickedDate));
    if(!cached)return pick;
    return{...pick,prices:cached.prices,priceSource:cached.priceSource,lastFetched:cached.lastFetched};
  });
}

// ── Excel export ──────────────────────────────────────────────────────────────
function loadXLSX(){
  return new Promise((resolve,reject)=>{
    if(window.XLSX)return resolve(window.XLSX);
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>resolve(window.XLSX);s.onerror=reject;
    document.head.appendChild(s);
  });
}
async function exportToExcel(picks){
  const XLSX=await loadXLSX();
  const wb=XLSX.utils.book_new();
  const rows=[["Symbol","Company","Picked Date","End Date (T+5)","Target Price","Expected %","Base Price","D1 %","D2 %","D3 %","D4 %","D5 %","Peak Price","Peak %","Peak Day","Hit Target?","Confidence","Source"]];
  const sorted=[...picks].sort((a,b)=>b.pickedDate.localeCompare(a.pickedDate));
  sorted.forEach(pick=>{
    const data=buildDayData(pick);const hit=calcHitTarget(pick);const p=pick.prices||{};
    const tp=effectiveTargetPrice(pick);const{peakPrice,peakPct,peakDay}=getPickPeakStats(pick);
    rows.push([
      pick.symbol,pick.company,pick.pickedDate,addTradingDays(pick.pickedDate,5),
      tp?tp:"",pick.expectedPct/100,p.baseNav||"",
      data[1]?data[1].cum/100:"",data[2]?data[2].cum/100:"",
      data[3]?data[3].cum/100:"",data[4]?data[4].cum/100:"",data[5]?data[5].cum/100:"",
      peakPrice||"",peakPct!=null?peakPct/100:"",peakDay?`D${peakDay}`:"",
      hit===null?"Pending":hit?"YES":"NO",
      pick.confidence||"",pick.priceSource||"",
    ]);
  });
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"]=[{wch:10},{wch:32},{wch:13},{wch:13},{wch:13},{wch:13},{wch:10},{wch:9},{wch:9},{wch:9},{wch:9},{wch:9},{wch:12},{wch:10},{wch:9},{wch:13},{wch:12},{wch:16}];
  sorted.forEach((_,i)=>{const r=i+2;["F","G","H","I","J","K","N"].forEach(c=>{const cell=ws[c+r];if(cell&&cell.v!=="")cell.z="0.00%";});});
  XLSX.utils.book_append_sheet(wb,ws,"Stock Picks");
  XLSX.writeFile(wb,`Stock_Picks_${todayStr()}.xlsx`);
}


// ── Price fetch ───────────────────────────────────────────────────────────────
// Returns { closeMap, highMap, lowMap } — all keyed by "yyyy-MM-dd"
async function fetchPriceHistory(symbol,fromDate,toDate){
  const p1=Math.floor(new Date(fromDate+"T00:00:00Z").getTime()/1000);
  const p2=Math.floor(new Date(toDate+"T23:59:59Z").getTime()/1000);
  const errors=[];
  const sources=[
    {name:"vercel-proxy",url:`/api/prices?symbol=${symbol}&from=${fromDate}&to=${toDate}`,type:"json"},
    {name:"corsproxy+chart",url:`https://corsproxy.io/?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${p2}`)}`,type:"json"},
    {name:"allorigins+dl",url:`https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${p1}&period2=${p2}&interval=1d&events=history`)}`,type:"csv"},
  ];
  for(const src of sources){
    try{
      const res=await fetch(src.url,{signal:AbortSignal.timeout(12000)});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const closeMap={},highMap={},lowMap={};
      if(src.type==="json"){
        const raw=await res.json();if(raw.error)throw new Error(raw.error);
        if(raw.priceMap&&Object.keys(raw.priceMap).length>0){
          // Vercel proxy: may return { closeMap, highMap, lowMap } or legacy { priceMap }
          if(raw.closeMap){Object.assign(closeMap,raw.closeMap);Object.assign(highMap,raw.highMap||{});Object.assign(lowMap,raw.lowMap||{});}
          else Object.assign(closeMap,raw.priceMap);
        } else if(raw.dates&&raw.closes){
          raw.dates.forEach((d,i)=>{if(raw.closes[i])closeMap[d]=+raw.closes[i].toFixed(4);if(raw.highs?.[i])highMap[d]=+raw.highs[i].toFixed(4);if(raw.lows?.[i])lowMap[d]=+raw.lows[i].toFixed(4);});
        } else {
          // Yahoo Finance chart JSON — has full OHLC
          const json=raw.contents?JSON.parse(raw.contents):raw;
          const result=json?.chart?.result?.[0];if(!result)throw new Error("No result");
          const quotes=result.indicators?.quote?.[0]||{};
          (result.timestamp||[]).forEach((ts,i)=>{
            const dateKey=dateToStr(new Date((ts+5*3600)*1000));
            if(quotes.close?.[i]!=null)closeMap[dateKey]=+quotes.close[i].toFixed(4);
            if(quotes.high?.[i]!=null) highMap[dateKey] =+quotes.high[i].toFixed(4);
            if(quotes.low?.[i]!=null)  lowMap[dateKey]  =+quotes.low[i].toFixed(4);
          });
        }
      }else{
        // CSV: Date,Open,High,Low,Close,Adj Close,Volume
        const wrapper=await res.json();const csv=(wrapper.contents||"").trim().split("\n").slice(1);
        csv.forEach(line=>{
          const cols=line.split(",");
          const close=parseFloat(cols[4]),high=parseFloat(cols[2]),low=parseFloat(cols[3]);
          if(cols[0]&&!isNaN(close))closeMap[cols[0].trim()]=+close.toFixed(4);
          if(cols[0]&&!isNaN(high)) highMap[cols[0].trim()] =+high.toFixed(4);
          if(cols[0]&&!isNaN(low))  lowMap[cols[0].trim()]  =+low.toFixed(4);
        });
      }
      if(Object.keys(closeMap).length===0)throw new Error("Empty");
      return {closeMap,highMap,lowMap};
    }catch(e){errors.push(`${src.name}: ${e.message}`);}
  }
  throw new Error(`Could not fetch "${symbol}". ${errors.join(" | ")}`);
}

async function fetchRealPrices(symbol,pickedDate){
  const tradingDates=[pickedDate];
  for(let i=1;i<=5;i++)tradingDates.push(addTradingDays(pickedDate,i));
  const today=todayStr();const neededDates=tradingDates.filter(d=>d<today); // exclude today — market has not closed yet
  const {closeMap,highMap,lowMap}=await fetchPriceHistory(symbol,neededDates[0],neededDates[neededDates.length-1]);

  function findClose(dateStr,exactOnly=false){
    if(closeMap[dateStr])return closeMap[dateStr];if(exactOnly)return null;
    for(let i=1;i<=3;i++){const d=new Date(dateStr+"T12:00:00");d.setDate(d.getDate()-i);const k=dateToStr(d);if(closeMap[k])return closeMap[k];}return null;
  }
  function findHigh(dateStr){return highMap[dateStr]||null;}
  function findLow(dateStr){return lowMap[dateStr]||null;}

  const prices={
    baseNav:findClose(neededDates[0],true),
    d1:neededDates[1]?findClose(neededDates[1]):null,
    d2:neededDates[2]?findClose(neededDates[2]):null,
    d3:neededDates[3]?findClose(neededDates[3]):null,
    d4:neededDates[4]?findClose(neededDates[4]):null,
    d5:neededDates[5]?findClose(neededDates[5]):null,
    // Intraday highs and lows for target-hit detection
    d1High:neededDates[1]?findHigh(neededDates[1]):null,
    d2High:neededDates[2]?findHigh(neededDates[2]):null,
    d3High:neededDates[3]?findHigh(neededDates[3]):null,
    d4High:neededDates[4]?findHigh(neededDates[4]):null,
    d5High:neededDates[5]?findHigh(neededDates[5]):null,
    d1Low:neededDates[1]?findLow(neededDates[1]):null,
    d2Low:neededDates[2]?findLow(neededDates[2]):null,
    d3Low:neededDates[3]?findLow(neededDates[3]):null,
    d4Low:neededDates[4]?findLow(neededDates[4]):null,
    d5Low:neededDates[5]?findLow(neededDates[5]):null,
  };
  if(prices.baseNav==null){const av=Object.keys(closeMap).sort().slice(-5).join(", ");throw new Error(`No price for ${symbol} on ${neededDates[0]}. Market may not have closed. Available: [${av||"none"}]`);}
  return{prices,source:"Yahoo Finance"};
}
async function refreshPickPrices(pick){
  const result=await fetchRealPrices(pick.symbol,pick.pickedDate);
  return{...pick,_fetching:false,prices:result.prices,priceSource:result.source,lastFetched:todayStr()};
}

// ── UI Components ─────────────────────────────────────────────────────────────
const Pct=({v,size=13})=>{const T=useT();if(v==null)return<span style={{color:T.muted,fontFamily:"'DM Mono',monospace",fontSize:size}}>—</span>;const pos=v>=0;return<span style={{color:pos?T.green:T.red,fontFamily:"'DM Mono',monospace",fontSize:size,fontWeight:700}}>{pos?"+":""}{parseFloat(v.toFixed(2))}%</span>;};
const Pill=({color,filled,children,small})=><span style={{display:"inline-flex",alignItems:"center",gap:3,padding:small?"2px 6px":"3px 8px",borderRadius:99,background:filled?color+"22":"transparent",border:`1px solid ${color}40`,fontSize:small?9:10,color,fontFamily:"'DM Mono',monospace",fontWeight:600,letterSpacing:"0.05em"}}>{children}</span>;
const ConfidenceDot=({level})=>{const T=useT();const map={High:T.green,Medium:T.amber,Low:T.red,high:T.green,medium:T.amber,low:T.red};const c=map[level]||T.muted;return<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:c,fontFamily:"'DM Mono',monospace"}}><span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block"}}/>{level||"—"}</span>;};
const HitBadge=({hit})=>{const T=useT();if(hit===null||hit===undefined)return<Pill color={T.amber}>⏳ Pending</Pill>;if(hit===true)return<Pill color={T.green} filled>✓ Hit</Pill>;return<Pill color={T.red} filled>✗ Missed</Pill>;};
const ProgressBar=({value,color})=>{const T=useT();return<div style={{height:3,borderRadius:99,background:T.border,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(value/5*100,100)}%`,background:color,borderRadius:99,transition:"width 0.4s ease"}}/></div>;};


// ── Tooltip ───────────────────────────────────────────────────────────────────
function TTip({active,payload,label}){
  const T=useT();
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:T.tooltipBg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",fontFamily:"'DM Mono',monospace",fontSize:12,boxShadow:"0 12px 40px #00000030"}}>
      <p style={{color:T.muted,margin:"0 0 6px",fontSize:10}}>{label}</p>
      {payload.map(p=><p key={p.name} style={{color:p.color,margin:"2px 0"}}>{p.name}: <b>{(+p.value)>=0?"+":""}{(+p.value).toFixed(2)}%</b></p>)}
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({pick,colorIdx,onClose,onRemove}){
  const T=useT();const color=col(colorIdx);
  const elapsed=Math.min(tradingDaysSince(pick.pickedDate),5);
  const allData=buildDayData(pick);const visible=allData.slice(0,elapsed+1);
  const current=visible[visible.length-1]?.cum??0;
  const currentPrice=visible[visible.length-1]?.price??null;
  const isComplete=elapsed>=5;const hit=calcHitTarget(pick);
  const endDate=addTradingDays(pick.pickedDate,5);
  const targetPct=getTargetPct(pick);const hasRealPrices=!!(pick.prices?.baseNav);
  const {peakPrice,peakPct,peakDay}=getPickPeakStats(pick);
  const SB=({label,children})=><div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 12px"}}><div style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",marginBottom:8}}>{label.toUpperCase()}</div>{children}</div>;
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"#00000090",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:20,padding:"30px 28px",width:"min(620px,100%)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 32px 80px #00000040"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:4,height:52,background:color,borderRadius:2}}/>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:600,color}}>{pick.symbol}</span>
                <HitBadge hit={hit}/>
                {!isComplete&&<Pill color={T.blue} filled>Day {elapsed}/5</Pill>}
                {pick.link&&<a href={pick.link} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:T.blue,fontFamily:"'DM Mono',monospace",textDecoration:"none",border:`1px solid ${T.blue}40`,borderRadius:99,padding:"2px 8px"}}>🔗 Source</a>}
              </div>
              <div style={{fontSize:13,color:T.muted}}>{pick.company}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
          <SB label="Picked"><span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:T.text}}>{pick.pickedDate}</span></SB>
          <SB label="End Date"><span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:isComplete?T.mutedLight:T.amber}}>{endDate}</span></SB>
          <SB label="Target Price">
            {(()=>{const tp=effectiveTargetPrice(pick);return tp
              ?<span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:T.green}}>${parseFloat(tp.toFixed(2))}{!pick.targetPrice&&pick.expectedPct?<span style={{fontSize:9,color:T.muted,display:"block",marginTop:2}}>{pick.expectedPct>0?"+":""}{parseFloat(pick.expectedPct.toFixed(2))}% implied</span>:null}</span>
              :<Pct v={pick.expectedPct}/>;})()}
          </SB>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
          <SB label="Current Price">{currentPrice?<span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:T.text}}>${currentPrice.toFixed(2)}</span>:<Pct v={current}/>}</SB>
          <SB label={`Highest Price${peakDay?` (D${peakDay})`:""}` }>
            {peakPrice!=null
              ?<span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:T.green}}>${peakPrice.toFixed(2)}</span>
              :<span style={{color:T.muted,fontFamily:"'DM Mono',monospace",fontSize:13}}>—</span>}
          </SB>
          <SB label="Highest Change %">
            {peakPct!=null
              ?<span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:peakPct>=0?T.green:T.red}}>{peakPct>=0?"+":""}{peakPct.toFixed(2)}%</span>
              :<span style={{color:T.muted,fontFamily:"'DM Mono',monospace",fontSize:13}}>—</span>}
          </SB>
        </div>
        {/* Target price breakdown */}
        {pick.prices?.baseNav&&(()=>{const tp=effectiveTargetPrice(pick);if(!tp)return null;return(
          <div style={{marginBottom:12,padding:"8px 12px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>Base: <span style={{color:T.text}}>${pick.prices.baseNav.toFixed(2)}</span></span>
            <span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>→ Target: <span style={{color:T.green}}>${tp.toFixed(2)}</span>{!pick.targetPrice?<span style={{fontSize:9,color:T.muted}}> (from {pick.expectedPct>0?"+":""}{pick.expectedPct}%)</span>:null}</span>
            <span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>Implies: <Pct v={targetPriceAsPct(pick)} size={11}/></span>
            <span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>Return so far: <Pct v={current} size={11}/></span>
          </div>
        );})()}
        {/* Confidence + Reasoning */}
        {(pick.confidence||pick.reasoning)&&(
          <div style={{marginBottom:14,padding:"12px 14px",borderRadius:10,background:T.surface,border:`1px solid ${T.border}`}}>
            {pick.confidence&&<div style={{marginBottom:pick.reasoning?8:0,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,color:T.muted,fontFamily:"'DM Mono',monospace"}}>CONFIDENCE:</span><ConfidenceDot level={pick.confidence}/></div>}
            {pick.reasoning&&<div style={{fontSize:12,color:T.textDim,lineHeight:1.7,fontStyle:"italic"}}>"{pick.reasoning}"</div>}
          </div>
        )}
        {/* Chart */}
        {hasRealPrices&&visible.length>1&&(
          <div style={{marginBottom:16,background:T.surface,borderRadius:12,padding:"14px 8px 8px"}}>
            <div style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.1em",marginBottom:8,paddingLeft:8}}>CUMULATIVE RETURN · ACTUAL vs TARGET</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={visible} margin={{top:5,right:20,left:-10,bottom:0}}>
                <XAxis dataKey="label" tick={{fontSize:8,fill:T.muted,fontFamily:"'DM Mono',monospace"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:8,fill:T.muted,fontFamily:"'DM Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${v}%`}/>
                <Tooltip contentStyle={{background:T.tooltipBg,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,fontFamily:"'DM Mono',monospace"}} formatter={(v)=>[`${v>0?"+":""}${v}%`,"Return"]}/>
                <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4"/>
                {targetPct!=null&&<ReferenceLine y={targetPct} stroke={color} strokeDasharray="6 4" strokeOpacity={0.5} label={{value:`Target ${targetPct>0?"+":""}${parseFloat(targetPct.toFixed(2))}%`,position:"insideTopRight",fill:color,fontSize:9,fontFamily:"'DM Mono',monospace"}}/>}
                <Line type="monotone" dataKey="cum" stroke={color} strokeWidth={2.5} dot={{r:3,fill:color,strokeWidth:0}} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* Day tiles with actual prices */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:16}}>
          {allData.map((d,i)=>{
            const reached=i<=elapsed;const pos=d.cum>=0;
            const tradingDate=i===0?pick.pickedDate:getTradingDayDates(pick.pickedDate)[i-1]?.date;
            return(
              <div key={i} style={{background:reached?(pos?T.green+"12":T.red+"12"):T.surface,border:`1px solid ${reached?(pos?T.green+"35":T.red+"35"):T.border}`,borderRadius:8,padding:"8px 4px",textAlign:"center",opacity:reached?1:0.4}}>
                <div style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",marginBottom:2}}>{d.label}</div>
                {tradingDate&&<div style={{fontSize:8,color:T.muted,fontFamily:"'DM Mono',monospace",marginBottom:3,opacity:0.7}}>{tradingDate.slice(5)}</div>}
                {d.price&&reached&&<div style={{fontSize:10,color:T.textDim,fontFamily:"'DM Mono',monospace",marginBottom:2}}>${d.price.toFixed(2)}</div>}
                {i>0&&reached&&<div style={{fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:700,color:d.daily>=0?T.green:T.red}}>{d.daily>=0?"▲":"▼"}{Math.abs(d.daily).toFixed(2)}%</div>}
              </div>
            );
          })}
        </div>
        {!hasRealPrices&&<div style={{marginBottom:14,padding:"10px 14px",borderRadius:8,background:T.amber+"12",border:`1px solid ${T.amber}30`}}><span style={{fontSize:11,color:T.amber,fontFamily:"'DM Mono',monospace"}}>⚠ No price data yet. Use ⟳ Refresh Prices to fetch live data.</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>Picked {pick.pickedDate} · Ends {endDate}</span>
          <button onClick={()=>{onRemove(pick.id);onClose();}} style={{background:T.red+"15",border:`1px solid ${T.red}30`,color:T.red,borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace"}}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ── Stock Card (FundCard style) ───────────────────────────────────────────────
function StockCard({pick,colorIdx,onClick,onFetch}){
  const T=useT();const color=col(colorIdx);
  const elapsed=Math.min(tradingDaysSince(pick.pickedDate),5);
  const data=buildDayData(pick);const visible=data.slice(0,elapsed+1);
  const current=visible[visible.length-1]?.cum??null;
  const isComplete=elapsed>=5;const hit=calcHitTarget(pick);
  const targetPct=getTargetPct(pick);
  const onTrack=current!==null&&(targetPct>0?current>0:targetPct<0?current<0:true);
  const endDate=addTradingDays(pick.pickedDate,5);
  const hasRealPrices=!!(pick.prices?.baseNav);
  const isFetching=pick._fetching;
  const fetchErr=!hasRealPrices&&!isFetching&&pick.priceNote;
  const {peakPrice,peakPct,peakDay}=getPickPeakStats(pick);
  return(
    <div onClick={onClick}
      style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px",cursor:"pointer",position:"relative",overflow:"hidden",transition:"all 0.2s",boxShadow:T.isDark?"none":"0 2px 12px rgba(0,0,0,0.06)"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"60";e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 10px 36px ${color}22`;e.currentTarget.style.background=T.surfaceHover;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=T.isDark?"none":"0 2px 12px rgba(0,0,0,0.06)";e.currentTarget.style.background=T.surface;}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color,borderRadius:"14px 14px 0 0"}}/>
      {isFetching&&<div style={{position:"absolute",top:6,right:8,fontSize:9,color:T.amber,fontFamily:"'DM Mono',monospace",animation:"blink 1s infinite"}}>⟳ fetching…</div>}
      {/* Top row: symbol + return */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{flex:1,minWidth:0,marginRight:8}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:600,color,marginBottom:3,display:"flex",alignItems:"center",gap:6}}>
            {pick.symbol}
            <span style={{fontSize:8,padding:"1px 6px",borderRadius:3,border:`1px solid ${pick._source==="sheet"?T.blue+"50":T.muted+"40"}`,color:pick._source==="sheet"?T.blue:T.muted,fontWeight:400}}>{pick._source==="sheet"?"SHEET":"MANUAL"}</span>
            {pick.confidence&&<ConfidenceDot level={pick.confidence}/>}
          </div>
          <div style={{fontSize:11,color:T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{pick.company||"—"}</div>
        </div>
        {current!==null?<Pct v={current} size={12}/>:<span style={{fontSize:11,color:T.muted,fontFamily:"'DM Mono',monospace"}}>—</span>}
      </div>
      {/* Dates */}
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        <span style={{fontSize:10,color:T.muted,fontFamily:"'DM Mono',monospace"}}>📅 {pick.pickedDate}</span>
        <span style={{fontSize:10,color:T.textDim}}>→</span>
        <span style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:isComplete?T.mutedLight:T.amber}}>{endDate}</span>
      </div>
      {/* Target + status badges */}
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:10,color:T.muted,fontFamily:"'DM Mono',monospace"}}>Target:</span>
        {(()=>{const tp=effectiveTargetPrice(pick);return tp
          ?<span style={{fontSize:10,color:T.green,fontFamily:"'DM Mono',monospace",fontWeight:700}}>${parseFloat(tp.toFixed(2))}{!pick.targetPrice&&pick.expectedPct?<span style={{fontSize:9,color:T.muted,marginLeft:3}}>(calc)</span>:null}</span>
          :<Pct v={pick.expectedPct} size={10}/>;})()}
        <HitBadge hit={hit}/>
        {!isComplete&&elapsed>0&&current!==null&&<Pill color={onTrack?T.green:T.red} filled>{onTrack?"On Track":"Off Track"}</Pill>}
      </div>
      {/* Peak price row */}
      {peakPrice!=null&&(
        <div style={{display:"flex",gap:12,marginBottom:8,padding:"5px 8px",borderRadius:6,background:T.green+"0A",border:`1px solid ${T.green}20`,alignItems:"center"}}>
          <span style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.08em"}}>PEAK{peakDay?` D${peakDay}`:""}:</span>
          <span style={{fontSize:11,color:T.green,fontFamily:"'DM Mono',monospace",fontWeight:700}}>${peakPrice.toFixed(2)}</span>
          <span style={{fontSize:11,color:peakPct>=0?T.green:T.red,fontFamily:"'DM Mono',monospace",fontWeight:700}}>{peakPct>=0?"+":""}{peakPct.toFixed(2)}%</span>
        </div>
      )}
      {/* Reasoning snippet */}
      {pick.reasoning&&<div style={{fontSize:10,color:T.textDim,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic",opacity:0.8}}>"{pick.reasoning}"</div>}
      {/* Fetch prompt */}
      {!hasRealPrices&&!isFetching&&(
        <div onClick={e=>{e.stopPropagation();onFetch(pick);}}
          style={{marginBottom:10,padding:"8px 10px",borderRadius:8,background:fetchErr?T.red+"12":T.amber+"12",border:`1px solid ${fetchErr?T.red+"40":T.amber+"30"}`,cursor:"pointer",display:"flex",alignItems:"flex-start",gap:8}}
          title="Click to retry fetch">
          <span style={{fontSize:13,flexShrink:0}}>{fetchErr?"⚠️":"📡"}</span>
          <div>
            <div style={{fontSize:10,color:fetchErr?T.red:T.amber,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{fetchErr?"Fetch failed — click to retry":"No price data — click to fetch"}</div>
            {fetchErr&&<div style={{fontSize:9,color:T.muted,marginTop:2,wordBreak:"break-word"}}>{String(fetchErr).slice(0,90)}</div>}
          </div>
        </div>
      )}
      {/* Mini chart */}
      <ResponsiveContainer width="100%" height={46}>
        <AreaChart data={visible} margin={{top:2,right:0,left:0,bottom:0}}>
          <defs><linearGradient id={`sg${colorIdx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
          <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3"/>
          <Area type="monotone" dataKey="cum" stroke={color} strokeWidth={1.5} fill={`url(#sg${colorIdx})`} dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
      {/* Progress bar + day counter */}
      <div style={{marginTop:8,marginBottom:6}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace"}}>{isComplete?"COMPLETED":`DAY ${elapsed} OF 5`}</span>
          <span style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace"}}>{elapsed}/5</span>
        </div>
        <ProgressBar value={elapsed} color={isComplete?(hit===true?T.green:hit===false?T.red:T.muted):color}/>
      </div>
      {/* Day dot row */}
      <div style={{display:"flex",gap:3}}>
        {[1,2,3,4,5].map(d=>{const reached=d<=elapsed;const pos=(data[d]?.cum??0)>=0;return(
          <div key={d} style={{flex:1,height:18,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",background:reached?(pos?T.green+"18":T.red+"18"):T.surface,border:`1px solid ${reached?(pos?T.green+"40":T.red+"40"):T.border}`}}>
            <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",color:reached?(pos?T.green:T.red):T.muted}}>D{d}</span>
          </div>
        );})}
      </div>
      {/* View details link */}
      <div style={{marginTop:10,textAlign:"right"}}>
        <span style={{fontSize:10,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em"}}>View details →</span>
      </div>
    </div>
  );
}

// ── Add Pick Form (FundTracker style) ────────────────────────────────────────
function AddPickForm({onAdd,onClose,taken}){
  const T=useT();
  const [ticker,setTicker]=useState("");const [company,setCompany]=useState("");
  const [pickedDate,setDate]=useState(todayStr());const [targetPrice,setTP]=useState("");
  const [expectedPct,setExp]=useState("");const [confidence,setConf]=useState("");
  const [reasoning,setReason]=useState("");const [link,setLink]=useState("");const [err,setErr]=useState("");
  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:9,color:T.text,padding:"11px 14px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box",transition:"border-color 0.15s",colorScheme:T.isDark?"dark":"light"};
  const F=({label,children})=>(<div><label style={{display:"block",fontSize:10,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",marginBottom:7}}>{label}</label>{children}</div>);
  const focus=e=>e.target.style.borderColor=T.blue;const blur=e=>e.target.style.borderColor=T.border;
  const handleAdd=()=>{
    const s=ticker.toUpperCase().trim();if(!s)return setErr("Enter a ticker symbol");
    if(!pickedDate)return setErr("Pick a date");
    if(!isMarketOpen(pickedDate))return setErr(`${pickedDate} is not a trading day`);
    const tp=parseFloat(String(targetPrice).replace(/[$,]/g,""))||null;
    const ep=parseFloat(String(expectedPct).replace("%",""))||0;
    if(!tp&&!ep)return setErr("Enter either a Target Price or Expected %");
    if(taken.some(t=>t.symbol===s&&t.pickedDate===pickedDate))return setErr(`${s} already tracked for ${pickedDate}`);
    onAdd({id:Date.now(),symbol:s,company:company.trim(),pickedDate,targetPrice:tp,expectedPct:ep,confidence,reasoning,link,_source:"manual"});onClose();
  };
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"#00000090",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:18,padding:"32px 28px",width:"min(480px,100%)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 32px 80px #00000040",animation:"up 0.28s cubic-bezier(0.16,1,0.3,1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:26}}>
          <div>
            <h3 style={{margin:0,fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:T.text}}>New Stock Pick</h3>
            <p style={{margin:"4px 0 0",fontSize:12,color:T.muted}}>Tracked for 5 trading days from pick date</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="TICKER *"><input value={ticker} onChange={e=>{setTicker(e.target.value.toUpperCase());setErr("");}} placeholder="AAPL" style={inp} onFocus={focus} onBlur={blur} onKeyDown={e=>e.key==="Enter"&&handleAdd()}/></F>
            <F label="PICK DATE *">
              <input type="date" value={pickedDate} onChange={e=>{setDate(e.target.value);setErr("");}} style={inp} onFocus={focus} onBlur={blur}/>
              {pickedDate&&!isMarketOpen(pickedDate)&&<div style={{marginTop:5,fontSize:10,color:T.amber,fontFamily:"'DM Mono',monospace"}}>⚠ Not a trading day</div>}
              {pickedDate&&isMarketOpen(pickedDate)&&<div style={{marginTop:5,fontSize:10,color:T.green,fontFamily:"'DM Mono',monospace"}}>✓ Market open</div>}
            </F>
          </div>
          <F label="COMPANY NAME"><input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Apple Inc." style={inp} onFocus={focus} onBlur={blur} onKeyDown={e=>e.key==="Enter"&&handleAdd()}/></F>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="TARGET PRICE ($)"><input value={targetPrice} onChange={e=>setTP(e.target.value)} placeholder="e.g. 185.00" style={inp} onFocus={focus} onBlur={blur}/></F>
            <F label="EXPECTED % (if no price)"><input value={expectedPct} onChange={e=>setExp(e.target.value)} placeholder="e.g. 5.0" style={inp} onFocus={focus} onBlur={blur}/></F>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <F label="CONFIDENCE">
              <select value={confidence} onChange={e=>setConf(e.target.value)} style={{...inp,cursor:"pointer"}}>
                <option value="">Select...</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
              </select>
            </F>
            <F label="LINK (optional)"><input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..." style={inp} onFocus={focus} onBlur={blur}/></F>
          </div>
          <F label="REASONING (optional)"><textarea value={reasoning} onChange={e=>setReason(e.target.value)} placeholder="Why this stock? What's the catalyst?" rows={3} style={{...inp,resize:"vertical"}}/></F>
        </div>
        {err&&<p style={{color:T.red,fontSize:12,margin:"12px 0 0",fontFamily:"'DM Mono',monospace"}}>⚠ {err}</p>}
        <div style={{display:"flex",gap:10,marginTop:22}}>
          <button onClick={onClose} style={{flex:1,padding:12,background:"none",border:`1px solid ${T.border}`,borderRadius:9,color:T.muted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Cancel</button>
          <button onClick={handleAdd} style={{flex:2,padding:12,background:T.blue,border:"none",borderRadius:9,color:T.isDark?"#060A10":"#fff",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,boxShadow:`0 0 20px ${T.blue}40`}}>Add to Tracker →</button>
        </div>
      </div>
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
function TrackingTable({picks,onRowClick}){
  const T=useT();const [sort,setSort]=useState({key:"pickedDate",dir:-1});
  const toggleSort=key=>setSort(s=>({key,dir:s.key===key?-s.dir:-1}));
  const arrow=key=>sort.key===key?(sort.dir===-1?" ↓":" ↑"):"";
  const rows=picks.map(pick=>{
    const data=buildDayData(pick);const elapsed=tradingDaysSince(pick.pickedDate);
    const current=data[Math.min(elapsed,data.length-1)]?.cum??null;
    const currentPrice=data[Math.min(elapsed,data.length-1)]?.price??null;
    const hit=calcHitTarget(pick);
    const{peakPrice,peakPct,peakDay}=getPickPeakStats(pick);
    return{pick,symbol:pick.symbol,company:pick.company,pickedDate:pick.pickedDate,
      targetPrice:pick.targetPrice,expectedPct:pick.expectedPct,current,currentPrice,hit,
      d1:data[1]?.cum??null,d2:data[2]?.cum??null,d3:data[3]?.cum??null,d4:data[4]?.cum??null,d5:data[5]?.cum??null,
      peakPrice,peakPct,peakDay,confidence:pick.confidence};
  });
  const sorted=[...rows].sort((a,b)=>{const av=a[sort.key]??-999,bv=b[sort.key]??-999;return typeof av==="string"?av.localeCompare(bv)*sort.dir:(av-bv)*sort.dir;});
  const Th=({k,label,w})=><th onClick={()=>toggleSort(k)} style={{padding:"10px 12px",textAlign:"left",fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.1em",cursor:"pointer",whiteSpace:"nowrap",width:w,userSelect:"none"}}>{label.toUpperCase()}{arrow(k)}</th>;
  const PC=({v})=>v==null?<td style={{padding:"10px 12px",color:T.muted,fontFamily:"'DM Mono',monospace",fontSize:12}}>—</td>:<td style={{padding:"10px 12px",color:v>=0?T.green:T.red,fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700}}>{v>=0?"+":""}{v.toFixed(2)}%</td>;
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:T.bgTableHead,borderBottom:`1px solid ${T.border}`}}>
          <Th k="symbol" label="Ticker" w="80px"/><Th k="company" label="Company" w="150px"/>
          <Th k="pickedDate" label="Date" w="100px"/>
          <th style={{padding:"10px 12px",fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.1em"}}>TARGET</th>
          <th style={{padding:"10px 12px",fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.1em"}}>CURRENT PRICE</th>
          <Th k="d1" label="D1" w="60px"/><Th k="d2" label="D2" w="60px"/><Th k="d3" label="D3" w="60px"/><Th k="d4" label="D4" w="60px"/><Th k="d5" label="D5" w="60px"/>
          <Th k="peakPrice" label="Peak Price" w="90px"/>
          <Th k="peakPct" label="Peak %" w="75px"/>
          <th style={{padding:"10px 12px",fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace"}}>HIT?</th>
        </tr></thead>
        <tbody>{sorted.map((row)=>{
          const c=col(picks.indexOf(row.pick));
          return<tr key={row.pick.id} onClick={()=>onRowClick(row.pick)} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background=T.surfaceHover}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:c}}>{row.symbol}</td>
            <td style={{padding:"10px 12px",color:T.textDim,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.company}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",color:T.muted,fontSize:11}}>{row.pickedDate}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:T.green}}>{(()=>{const tp=effectiveTargetPrice(row.pick);return tp?`$${parseFloat(tp.toFixed(2))}${!row.pick.targetPrice?" (calc)":""}`:row.expectedPct?`${row.expectedPct>0?"+":""}${parseFloat(row.expectedPct.toFixed(2))}%`:"—";})()}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",color:T.text}}>{row.currentPrice?`$${row.currentPrice.toFixed(2)}`:"—"}</td>
            <PC v={row.d1}/><PC v={row.d2}/><PC v={row.d3}/><PC v={row.d4}/><PC v={row.d5}/>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:T.green}}>{row.peakPrice!=null?`$${row.peakPrice.toFixed(2)}${row.peakDay?` D${row.peakDay}`:""}` :"—"}</td>
            <td style={{padding:"10px 12px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:row.peakPct!=null?(row.peakPct>=0?T.green:T.red):T.muted}}>{row.peakPct!=null?`${row.peakPct>=0?"+":""}${row.peakPct.toFixed(2)}%`:"—"}</td>
            <td style={{padding:"10px 12px"}}><HitBadge hit={row.hit}/></td>
            <td style={{padding:"10px 12px"}}><ConfidenceDot level={row.confidence}/></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function StockTracker({ isDark: isDarkProp, onToggleTheme }){
  const [picks,setPicks]=useState(null);const [manualPicks,setManual]=useState([]);
  const [showAdd,setShowAdd]=useState(false);const [detail,setDetail]=useState(null);
  const [cardFilter,setFilter]=useState("all");const [ready,setReady]=useState(false);
  const [localDark,setLocalDark]=useState(true);const [syncing,setSyncing]=useState(false);
  const [syncMsg,setSyncMsg]=useState("");const [view,setView]=useState("cards");
  const [exporting,setExp]=useState(false);
  const isDark=isDarkProp!==undefined?isDarkProp:localDark;
  const T=isDark?DARK:LIGHT;
  const toggleDark=()=>{ if(onToggleTheme){onToggleTheme();}else{const n=!localDark;setLocalDark(n);saveTheme(n?"dark":"light");} };

  useEffect(()=>{
    (async()=>{
      const thm=await loadTheme();if(isDarkProp===undefined)setLocalDark(thm!=="light");
      // Load local cache — saveStorage stores the full pick list (sheet + manual)
      const [savedPicks,manual]=await Promise.all([loadPriceCache(),loadManualPicks()]);
      // savedPicks already contains all picks from last sync, just display them immediately
      const localMerged = savedPicks.length > 0 ? savedPicks : manual;
      setPicks(localMerged);setManual(manual);setReady(true);
      // Auto-sync sheet in background on every load
      if(SHEET_API_URL){
        setSyncing(true);
        try{
          const sheetPicks=await fetchSheetPicks();
          const merged=mergePicks(sheetPicks,manual,savedPicks);
          setPicks(merged);
          await saveStorage(merged);
          const missing=merged.filter(p=>!p.prices?.baseNav);
          if(missing.length)autoFetchMissing(missing,merged);
        }catch(e){
          const missing2=localMerged.filter(p=>!p.prices?.baseNav);
          if(missing2.length)autoFetchMissing(missing2,localMerged);
        }finally{setSyncing(false);}
      }else{
        const missing=localMerged.filter(p=>!p.prices?.baseNav);
        if(missing.length)autoFetchMissing(missing,localMerged);
      }
    })();
  },[]);

  const autoFetchMissing=async(missing,allPicks)=>{
    const results=await Promise.allSettled(missing.map(p=>refreshPickPrices(p)));
    setPicks(prev=>{const next=prev.map(p=>{const idx=missing.findIndex(m=>m.id===p.id);if(idx===-1)return p;const r=results[idx];return r.status==="fulfilled"?r.value:{...p,priceNote:r.reason?.message};});persist(next);return next;});
  };
  const persist=useCallback(async(updated)=>{await saveStorage(updated);await saveManualPicks(updated.filter(p=>p._source==="manual"));},[] );

  const syncFromSheet=async()=>{
    setSyncing(true);setSyncMsg("");
    try{
      const [sheetPicks,priceCache,manual]=await Promise.all([fetchSheetPicks(),loadPriceCache(),loadManualPicks()]);
      const merged=mergePicks(sheetPicks,manual,priceCache);
      setPicks(merged);setManual(manual);
      await saveStorage(merged);
      setSyncMsg(`✓ Synced ${sheetPicks.length} picks`);
      const missing=merged.filter(p=>!p.prices?.baseNav);if(missing.length)autoFetchMissing(missing,merged);
    }catch(e){setSyncMsg(`✗ ${e.message}`);}
    finally{setSyncing(false);setTimeout(()=>setSyncMsg(""),4000);}
  };

  const addPick=async(p)=>{
    const newManual=[...manualPicks,p];setManual(newManual);
    const next=[...(picks||[]),p];setPicks(next);persist(next);
    try{const updated=await refreshPickPrices(p);const um=newManual.map(x=>x.id===p.id?updated:x);setManual(um);setPicks(prev=>{const n=prev.map(x=>x.id===p.id?updated:x);persist(n);return n;});}
    catch(e){setPicks(prev=>{const n=prev.map(x=>x.id===p.id?{...x,priceNote:e.message}:x);persist(n);return n;});}
  };
  const removePick=async(id)=>{const um=manualPicks.filter(p=>p.id!==id);setManual(um);await saveManualPicks(um);const next=picks.filter(p=>p.id!==id);setPicks(next);await saveStorage(next);};
  const refreshAllPrices=async()=>{if(!picks?.length)return;const results=await Promise.allSettled(picks.map(p=>refreshPickPrices(p)));setPicks(prev=>{const next=prev.map((p,i)=>results[i].status==="fulfilled"?results[i].value:{...p,priceNote:results[i].reason?.message});persist(next);return next;});};
  const fetchSinglePick=async(pick)=>{const updated=await refreshPickPrices(pick);setPicks(prev=>{const next=prev.map(p=>p.id===pick.id?updated:p);persist(next);return next;});};
  const handleExport=async()=>{setExp(true);try{await exportToExcel(allPicks);}catch(e){alert("Export failed: "+e.message);}finally{setExp(false);};};

  if(!ready)return<ThemeCtx.Provider value={T}><div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:T.muted,fontFamily:"'DM Mono',monospace"}}>Loading...</span></div></ThemeCtx.Provider>;

  const allPicks=picks||[];
  const active=allPicks.filter(p=>tradingDaysSince(p.pickedDate)<5);
  const completed=allPicks.filter(p=>tradingDaysSince(p.pickedDate)>=5);
  const hitCount=completed.filter(p=>calcHitTarget(p)===true).length;
  const hitRate=completed.length>0?Math.round((hitCount/completed.length)*100):null;
  const sortNewest=arr=>[...arr].sort((a,b)=>b.pickedDate.localeCompare(a.pickedDate));
  const filtered=sortNewest(cardFilter==="active"?active:cardFilter==="completed"?completed:allPicks);
  const detailIdx=detail?allPicks.findIndex(p=>p.id===detail.id):-1;

  const overlayData = active.length > 0
    ? [0,1,2,3,4,5].map(d => {
        const pt = { label: d===0?"D0":`D${d}` };
        active.forEach(p => { const dd = buildDayData(p); pt[`${p.symbol}_${p.id}`] = dd[d]?.cum ?? null; });
        return pt;
      })
    : [];

  return(
    <ThemeCtx.Provider value={T}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif",transition:"background 0.3s, color 0.3s"}}>
        <div style={{position:"fixed",inset:0,pointerEvents:"none",backgroundImage:`linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`,backgroundSize:"44px 44px",transition:"background-image 0.3s"}} />
        {/* ── Sticky Header Bar ── */}
        <div style={{position:"sticky",top:0,zIndex:100,background:T.isDark?"rgba(6,10,16,0.92)":"rgba(238,242,255,0.95)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:`1px solid ${T.border}`,transition:"background 0.3s, border-color 0.3s"}}>
          <div style={{maxWidth:1220,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58,gap:12,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:T.blue,boxShadow:`0 0 10px ${T.blue}`,animation:"blink 2s infinite"}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:T.blue,letterSpacing:"0.18em"}}>STOCK PICK TRACKER</span>
              </div>
              {syncMsg&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:syncMsg.startsWith("✓")?T.green:syncMsg.startsWith("⚠")?T.amber:T.red,maxWidth:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{syncMsg}</span>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <button onClick={syncFromSheet} disabled={syncing}
                style={{padding:"8px 16px",background:"transparent",border:`1px solid ${T.green}50`,borderRadius:9,color:T.green,cursor:syncing?"wait":"pointer",fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:11,display:"flex",alignItems:"center",gap:6,opacity:syncing?0.6:1,transition:"all 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.background=T.green+"18"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >{syncing?"⟳ Syncing…":"⬆ Sync Sheet"}</button>
              {allPicks.length>0&&(
                <button onClick={refreshAllPrices}
                  style={{padding:"8px 16px",background:"transparent",border:`1px solid ${T.blue}50`,borderRadius:9,color:T.blue,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:11,display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.blue+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >⟳ Refresh Prices</button>
              )}
              {allPicks.length>0&&(
                <button onClick={handleExport} disabled={exporting}
                  style={{padding:"8px 16px",background:"transparent",border:`1px solid ${T.amber}50`,borderRadius:9,color:T.amber,cursor:exporting?"wait":"pointer",fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:11,display:"flex",alignItems:"center",gap:6,opacity:exporting?0.6:1,transition:"all 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.amber+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >{exporting?"⟳ Exporting…":"⬇ Export Excel"}</button>
              )}
              <button onClick={()=>setShowAdd(true)} style={{background:T.blue,border:"none",borderRadius:9,color:T.isDark?"#060A10":"#fff",padding:"9px 18px",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:7,boxShadow:`0 0 22px ${T.blue}35`}}>
                + Add Pick
              </button>
            </div>
          </div>
        </div>

        <div style={{maxWidth:1220,margin:"0 auto",padding:"32px 20px",position:"relative"}}>

          {/* ── Page title ── */}
          <div style={{marginBottom:24,opacity:ready?1:0,transform:ready?"none":"translateY(-10px)",transition:"all 0.5s cubic-bezier(0.16,1,0.3,1)"}}>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(22px,3vw,34px)",fontWeight:800,margin:0,letterSpacing:"-0.025em",color:T.text}}>
              Stock <span style={{color:T.blue}}>Performance</span>
            </h1>
            <p style={{color:T.muted,fontSize:13,margin:"5px 0 0",fontWeight:300}}>
              {allPicks.length} picks · {active.length} active · {completed.length} completed{hitRate!==null?` · ${hitRate}% hit rate`:""}
            </p>
          </div>

          {/* ── Stats ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(138px,1fr))",gap:12,marginBottom:24,opacity:ready?1:0,transform:ready?"none":"translateY(12px)",transition:"all 0.5s cubic-bezier(0.16,1,0.3,1) 0.07s"}}>
            {[
              {label:"Total Picks",v:allPicks.length,color:T.text},
              {label:"Active",v:active.length,color:T.blue},
              {label:"Completed",v:completed.length,color:T.mutedLight},
              {label:"Hit Rate",v:hitRate!==null?`${hitRate}%`:"–",color:hitRate!==null?(hitRate>=60?T.green:T.red):T.muted},
              {label:"Hits",v:hitCount,color:T.green},
              {label:"Avg Return",v:(()=>{const wp=completed.filter(p=>p.prices?.d5!=null);if(!wp.length)return<span style={{color:T.muted,fontFamily:"'DM Mono',monospace"}}>–</span>;const avg=wp.reduce((s,p)=>{const d=buildDayData(p);return s+(d[5]?.cum??0);},0)/wp.length;const pos=avg>=0;return<span style={{color:pos?T.green:T.red,fontFamily:"'DM Mono',monospace",fontWeight:600}}>{pos?"+":""}{avg.toFixed(2)}%</span>;})()},
            ].map((s,i)=>(
              <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"15px 17px",boxShadow:T.isDark?"none":"0 1px 8px rgba(0,0,0,0.05)",transition:"background 0.3s, border-color 0.3s"}}>
                <div style={{fontSize:9,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em",marginBottom:10}}>{s.label.toUpperCase()}</div>
                <div style={{fontSize:21,fontFamily:"'Syne',sans-serif",fontWeight:700,color:s.color||T.text}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* ── Overlay chart ── */}
          {active.length>0&&(
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"20px 18px 14px",marginBottom:24,opacity:ready?1:0,transition:"opacity 0.5s ease 0.12s, background 0.3s",boxShadow:T.isDark?"none":"0 2px 16px rgba(0,0,0,0.06)"}}>
              <p style={{margin:"0 0 14px 4px",fontSize:10,color:T.muted,fontFamily:"'DM Mono',monospace",letterSpacing:"0.12em"}}>ACTIVE PICKS · CUMULATIVE RETURN</p>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={overlayData} margin={{top:4,right:16,left:0,bottom:0}}>
                  <XAxis dataKey="label" tick={{fill:T.muted,fontSize:10,fontFamily:"'DM Mono',monospace"}} axisLine={{stroke:T.border}} tickLine={false}/>
                  <YAxis tickFormatter={v=>`${v>=0?"+":""}${v.toFixed(1)}%`} tick={{fill:T.muted,fontSize:10,fontFamily:"'DM Mono',monospace"}} axisLine={false} tickLine={false} width={52}/>
                  <Tooltip content={<TTip/>}/>
                  <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4"/>
                  {active.map(p=>(
                    <Line key={p.id} type="monotone" dataKey={`${p.symbol}_${p.id}`} name={`${p.symbol} (${p.pickedDate})`}
                      stroke={col(allPicks.indexOf(p))} strokeWidth={2}
                      dot={{r:3,fill:col(allPicks.indexOf(p)),strokeWidth:0}} connectNulls={false}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:8}}>
                {active.map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>setDetail(p)}>
                    <div style={{width:12,height:3,borderRadius:2,background:col(allPicks.indexOf(p))}}/>
                    <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:col(allPicks.indexOf(p))}}>{p.symbol}</span>
                    <span style={{fontSize:10,color:T.muted}}>{p.pickedDate} · D{tradingDaysSince(p.pickedDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Filter tabs + view toggle ── */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",gap:6}}>
              {[["all","All Cards"],["active","Active"],["completed","Completed"]].map(([v,l])=>(
                <button key={v} onClick={()=>setFilter(v)} style={{
                  padding:"7px 16px",borderRadius:8,cursor:"pointer",
                  border:cardFilter===v?`1px solid ${T.blue}50`:`1px solid ${T.border}`,
                  background:cardFilter===v?T.blue+"14":"transparent",
                  color:cardFilter===v?T.blue:T.muted,
                  fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"0.08em",transition:"all 0.15s",
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:6}}>
              {[["cards","⊞ Cards"],["table","≡ Table"]].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)} style={{
                  padding:"7px 14px",borderRadius:8,cursor:"pointer",
                  border:`1px solid ${view===v?T.blue+"50":T.border}`,
                  background:view===v?T.blue+"14":"transparent",
                  color:view===v?T.blue:T.muted,
                  fontFamily:"'DM Mono',monospace",fontSize:10,transition:"all 0.15s",
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* ── Cards ── */}
          {view==="cards"&&(filtered.length===0?(
            <div style={{border:`2px dashed ${T.border}`,borderRadius:16,padding:"48px 20px",textAlign:"center",color:T.muted,marginBottom:36}}>
              <div style={{fontSize:32,marginBottom:10}}>📈</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,marginBottom:6,color:T.text}}>No picks here</div>
              <div style={{fontSize:13}}>Hit <b style={{color:T.blue}}>+ Add Pick</b> to start tracking</div>
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:14,marginBottom:36}}>
              {filtered.map(pick=><StockCard key={pick.id} pick={pick} colorIdx={allPicks.indexOf(pick)} onClick={()=>setDetail(pick)} onFetch={fetchSinglePick}/>)}
            </div>
          ))}

          {/* ── Table ── */}
          {view==="table"&&allPicks.length>0&&(
            <div style={{opacity:ready?1:0,transition:"opacity 0.5s ease 0.2s"}}>
              <TrackingTable picks={filtered} onRowClick={setDetail}/>
            </div>
          )}
        </div>
        {showAdd&&<AddPickForm onAdd={addPick} onClose={()=>setShowAdd(false)} taken={allPicks}/>}
        {detail&&<DetailModal pick={detail} colorIdx={detailIdx} onClose={()=>setDetail(null)} onRemove={removePick}/>}

        <style>{`
          @keyframes up{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
          @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.25;}}
          *{box-sizing:border-box;}
          ::-webkit-scrollbar{width:5px;height:5px;}
          ::-webkit-scrollbar-track{background:${T.scrollTrack};}
          ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:3px;}
        `}</style>
      </div>
    </ThemeCtx.Provider>
  );
}
