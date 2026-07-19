import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bitcoin,
  ChartPie,
  CircleDollarSign,
  Play,
  LockKeyhole,
  Layers3,
  Gauge,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Reveal } from "@/components/ui";
import { EquityChart } from "@/components/equity-chart";
import { AdminEntrance } from "@/components/admin-entrance";

const features = [
  { icon: BarChart3, title: "Advanced charts", copy: "Live data with institutional-grade analysis tools." },
  { icon: ShieldCheck, title: "Secure & reliable", copy: "Protection designed to keep your account safe." },
  { icon: Zap, title: "Lightning fast", copy: "Rapid execution when every second matters." },
  { icon: ChartPie, title: "One platform", copy: "Education, research, and strategies in one place." },
];

function MarketBadge({ type, className }: { type: "Forex" | "Crypto" | "Stocks"; className: string }) {
  const Icon = type === "Crypto" ? Bitcoin : type === "Forex" ? CircleDollarSign : TrendingUp;
  return (
    <div className={`market-badge ${className}`}>
      <span className="market-badge-icon"><Icon size={22} /></span>
      <span>{type}</span>
    </div>
  );
}

function TradingPhone() {
  return (
    <div className="hero-visual" aria-label="EdgeLedger mobile trading dashboard preview">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <span className="spark spark-one" />
      <span className="spark spark-two" />
      <span className="spark spark-three" />
      <div className="coin-3d coin-btc"><span>₿</span></div>
      <div className="coin-3d coin-euro"><span>€</span></div>
      <div className="market-cube"><i /><i /><i /></div>
      <MarketBadge type="Forex" className="badge-forex" />
      <MarketBadge type="Crypto" className="badge-crypto" />
      <MarketBadge type="Stocks" className="badge-stocks" />

      <div className="phone-stage">
        <div className="phone-shadow" />
        <div className="phone-shell">
          <div className="phone-speaker" />
          <div className="phone-screen">
            <div className="phone-topline"><span>EUR / USD</span><span className="phone-time">1H</span></div>
            <div className="phone-price"><strong>1.08452</strong><span>+0.65%</span></div>
            <div className="phone-chart"><EquityChart compact /><span className="chart-price-tag">1.08452</span></div>
            <div className="phone-stats">
              <span><small>Open</small>1.08135</span>
              <span><small>High</small>1.08692</span>
              <span><small>Volume</small>8.2M</span>
            </div>
          </div>
        </div>
        <div className="platform-ring"><span /></div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero-section">
        <div className="hero-aurora hero-aurora-left" />
        <div className="hero-aurora hero-aurora-right" />
        <div className="hero-grid" />
        <div className="container-shell hero-layout">
          <Reveal className="hero-copy">
            <div className="hero-pill"><Sparkles size={15} /> Next-generation trading intelligence</div>
            <h1>Trade smarter.<br /><span>Grow faster.</span></h1>
            <p>Learn, test, and trade with confidence. EdgeLedger brings verified strategies, expert education, and powerful market tools together.</p>
            <div className="hero-actions">
              <Link href="/signup" className="cta-primary">Start trading now <span><ArrowRight size={18} /></span></Link>
              <Link href="/courses" className="cta-video"><span><Play size={16} fill="currentColor" /></span> Watch platform tour</Link>
            </div>
            <AdminEntrance />
            <div className="hero-proof">
              <div className="avatar-stack"><i>AK</i><i>JM</i><i>SL</i><i>+</i></div>
              <div><strong>24,328 active traders</strong><span>Learning and building their edge</span></div>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="hero-device-wrap"><TradingPhone /></Reveal>
        </div>
      </section>

      <section className="feature-wrap">
        <div className="container-shell feature-panel">
          {features.map(({ icon: Icon, title, copy }, index) => (
            <Reveal key={title} delay={index * 0.05} className="feature-item">
              <span className="feature-icon"><Icon size={22} /></span>
              <div><h2>{title}</h2><p>{copy}</p></div>
            </Reveal>
          ))}
          <div className="live-card">
            <div className="live-chart-bars" aria-hidden="true">
              {[28, 44, 36, 58, 49, 68, 60, 80, 72, 91].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
            <div><span><b /> Live members</span><strong>24,328 <em>+12.5%</em></strong></div>
          </div>
        </div>
      </section>

      <section className="pro-suite">
        <div className="container-shell">
          <Reveal className="suite-heading">
            <div><span>THE EDGELEDGER SYSTEM</span><h2>One disciplined workflow.<br />Built for serious traders.</h2></div>
            <p>Move from structured learning to verified research and confident execution without switching between scattered tools.</p>
          </Reveal>
          <div className="suite-grid">
            {[
              { icon: Layers3, step: "01", title: "Learn the framework", copy: "Focused courses, annotated executions, and practical drills built around real market structure.", meta: "18 expert modules" },
              { icon: Gauge, step: "02", title: "Validate the edge", copy: "Inspect trade logs, drawdowns, risk profiles, and repeatable setups before you deploy capital.", meta: "24,180 trades logged" },
              { icon: LockKeyhole, step: "03", title: "Execute with clarity", copy: "Keep your research, progress, saved systems, and private content inside one secure member desk.", meta: "Private member workspace" },
            ].map(({ icon: Icon, step, title, copy, meta }, index) => (
              <Reveal key={title} delay={index * .08} className="suite-card">
                <div className="suite-card-top"><span>{step}</span><Icon size={25} /></div>
                <h3>{title}</h3><p>{copy}</p><strong>{meta}<ArrowRight size={15} /></strong>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="trusted-section">
        <div className="container-shell">
          <p>Built for modern traders across every market</p>
          <div className="trusted-logos" aria-label="Supported markets and tools">
            <span>FOREX</span><span>CRYPTO</span><span>INDICES</span><span>TRADINGVIEW</span><span>METATRADER 5</span>
          </div>
        </div>
      </section>
    </>
  );
}
