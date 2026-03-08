import { useState, useEffect } from "react";
import TrackerSelector from "./components/TrackerSelector";
import FundTracker from "./pages/FundTracker";
import StockTracker from "./pages/StockTracker";
import PredictionMarket from "./pages/PredictionMarket";

const THEME_KEY = "app-global-theme";

export default function App() {
  const [page, setPage] = useState("fund");
  const [isDark, setIsDark] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) setIsDark(saved !== "light");
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
  };

  return (
    <>
      <TrackerSelector active={page} onChange={setPage} isDark={isDark} onToggleTheme={toggleTheme} />

      {/* Offset content below the fixed nav bar */}
      <div style={{ paddingTop: 54 }}>
        {page === "fund"       && <FundTracker       isDark={isDark} onToggleTheme={toggleTheme} />}
        {page === "stock"      && <StockTracker      isDark={isDark} onToggleTheme={toggleTheme} />}
        {page === "prediction" && <PredictionMarket  isDark={isDark} onToggleTheme={toggleTheme} />}
      </div>
    </>
  );
}
