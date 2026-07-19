export const equity = [100, 102, 101, 105, 109, 107, 114, 118, 117, 123, 127, 125, 132, 137, 134, 141, 146, 151, 148, 156, 163, 168, 165, 174].map((value, i) => ({ trade: i + 1, value }));

/** Offline fallbacks aligned with prisma seed slugs so deep links stay consistent. */
export const strategies = [
  { slug: "london-breakout", title: "London Session Breakout", concept: "Asian range breakout", instrument: "GBP/USD", timeframe: "15M", winRate: 62.5, rr: 1.8, drawdown: 8.2, trades: 48, access: "MEMBER" },
  { slug: "mean-reversion-rsi", title: "RSI Mean Reversion", concept: "RSI divergence fade", instrument: "NAS100", timeframe: "1H", winRate: 58.3, rr: 1.5, drawdown: 12.1, trades: 60, access: "FREE" },
  { slug: "btc-weekly-momentum", title: "BTC Weekly Momentum", concept: "Weekly trend ride", instrument: "BTC/USD", timeframe: "1W", winRate: 61.0, rr: 2.1, drawdown: 9.4, trades: 36, access: "MEMBER" },
  { slug: "london-liquidity-reversal", title: "London Liquidity Reversal", concept: "Liquidity sweep + MSS", instrument: "GBP/USD", timeframe: "5M", winRate: 68.4, rr: 2.31, drawdown: 6.8, trades: 114, access: "MEMBER" },
  { slug: "ny-open-displacement", title: "New York Open Displacement", concept: "FVG + order block", instrument: "NAS100", timeframe: "3M", winRate: 64.2, rr: 2.76, drawdown: 8.1, trades: 86, access: "VIP" },
  { slug: "asia-range-expansion", title: "Asia Range Expansion", concept: "BOS + session range", instrument: "XAU/USD", timeframe: "15M", winRate: 61.8, rr: 3.04, drawdown: 7.4, trades: 73, access: "MEMBER" },
];

export const courses = [
  { title: "Market Structure, Without the Myth", level: "Foundation", market: "Forex", lessons: 18, duration: "6h 40m", progress: 72, tone: "profit" },
  { title: "Building a Backtest That Survives", level: "Intermediate", market: "All markets", lessons: 14, duration: "5h 15m", progress: 0, tone: "brass" },
  { title: "Execution Under Volatility", level: "Advanced", market: "Indices", lessons: 11, duration: "4h 05m", progress: 24, tone: "loss" },
];

export const trades = [
  ["12 JUN 2026", "GBP/USD", "LONG", "WIN", "+2.40R"],
  ["11 JUN 2026", "GBP/USD", "SHORT", "WIN", "+1.86R"],
  ["10 JUN 2026", "GBP/USD", "LONG", "LOSS", "−1.00R"],
  ["08 JUN 2026", "GBP/USD", "SHORT", "WIN", "+3.12R"],
  ["07 JUN 2026", "GBP/USD", "SHORT", "BE", "+0.08R"],
  ["05 JUN 2026", "GBP/USD", "LONG", "WIN", "+2.27R"],
];
