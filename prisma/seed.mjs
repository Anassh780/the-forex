import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'
const { hashSync } = bcryptjs

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edgeledger.com' },
    update: {},
    create: {
      email: 'admin@edgeledger.com',
      passwordHash: hashSync('admin123', 10),
      role: 'admin',
    },
  })

  const member = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      passwordHash: hashSync('member123', 10),
      role: 'member',
    },
  })

  const freeUser = await prisma.user.upsert({
    where: { email: 'free@example.com' },
    update: {},
    create: {
      email: 'free@example.com',
      passwordHash: hashSync('free123', 10),
      role: 'free',
    },
  })

  const strategy1 = await prisma.strategy.upsert({
    where: { slug: 'london-breakout' },
    update: {},
    create: {
      slug: 'london-breakout',
      title: 'London Session Breakout',
      concept: 'Captures the volatility expansion as the London session opens',
      instrument: 'GBP/USD, EUR/USD',
      timeframe: '15M',
      description: 'This strategy exploits the predictable volatility increase when London opens. We identify the Asian session range and trade the breakout with a tight stop below/above the range.',
      accessTier: 'member',
      published: true,
    },
  })

  const strategy2 = await prisma.strategy.upsert({
    where: { slug: 'mean-reversion-rsi' },
    update: {},
    create: {
      slug: 'mean-reversion-rsi',
      title: 'RSI Mean Reversion',
      concept: 'Fades overextended moves using RSI divergence',
      instrument: 'S&P 500, NASDAQ',
      timeframe: '1H',
      description: 'Identifies overextended price moves using RSI divergence on the hourly chart. Entries are taken when price returns inside the Bollinger Bands with confirmation from volume.',
      accessTier: 'free',
      published: true,
    },
  })

  const strategy3 = await prisma.strategy.upsert({
    where: { slug: 'btc-weekly-momentum' },
    update: {},
    create: {
      slug: 'btc-weekly-momentum',
      title: 'BTC Weekly Momentum',
      concept: 'Rides strong weekly momentum trends in Bitcoin',
      instrument: 'BTC/USD',
      timeframe: '1W',
      description: 'A trend-following strategy that enters on weekly closes above the 20 EMA with increasing volume. Targets 2-3R with a trailing stop at the previous week low.',
      accessTier: 'member',
      published: true,
    },
  })

  // Add backtest results
  const backtest1 = await prisma.backtestResult.upsert({
    where: { strategyId: strategy1.id },
    update: {},
    create: {
      strategyId: strategy1.id,
      winRate: 62.5,
      avgRR: 1.8,
      maxDrawdown: 8.2,
      totalTrades: 48,
      equityCurveData: JSON.stringify(
        Array.from({ length: 48 }, (_, i) => ({
          trade: i + 1,
          equity: 10000 + (i * 150) + (Math.sin(i * 0.5) * 500),
        }))
      ),
    },
  })

  await prisma.trade.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      backtestId: backtest1.id,
      date: new Date(2024, 0, 1 + i * 7),
      pair: i % 2 === 0 ? 'GBP/USD' : 'EUR/USD',
      direction: i % 3 === 0 ? 'short' : 'long',
      result: i % 4 === 0 ? 'loss' : 'win',
      rMultiple: i % 4 === 0 ? -1 : 1.2 + (i * 0.2),
    })),
  })

  const backtest2 = await prisma.backtestResult.upsert({
    where: { strategyId: strategy2.id },
    update: {},
    create: {
      strategyId: strategy2.id,
      winRate: 58.3,
      avgRR: 1.5,
      maxDrawdown: 12.1,
      totalTrades: 60,
      equityCurveData: JSON.stringify(
        Array.from({ length: 60 }, (_, i) => ({
          trade: i + 1,
          equity: 10000 + (i * 120) + (Math.cos(i * 0.3) * 400),
        }))
      ),
    },
  })

  // Add saved strategy
  await prisma.savedStrategy.upsert({
    where: { userId_strategyId: { userId: member.id, strategyId: strategy1.id } },
    update: {},
    create: {
      userId: member.id,
      strategyId: strategy1.id,
    },
  })

  console.log('Seed complete:', {
    users: [admin.email, member.email, freeUser.email],
    courses: 'Managed from Google Drive folders',
    strategies: [strategy1.title, strategy2.title, strategy3.title],
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
