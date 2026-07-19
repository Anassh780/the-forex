import Link from "next/link";
import { ArrowUpRight, ShieldCheck, TrendingUp, X, Zap } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { ScreenPalLoopPlayer } from "@/components/screenpal-loop-player";

export function AuthExperience({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  return (
    <section className="auth-experience">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <div className="auth-frame">
        <div className="auth-panel">
          <Link href="/" className="auth-brand">
            <span>
              <Zap size={17} fill="currentColor" />
            </span>
            Edge<strong>Ledger</strong>
          </Link>
          <div className="auth-panel-inner">
            <div className="auth-kicker">
              <i /> {signup ? "OPEN YOUR TRADING DESK" : "SECURE MEMBER ACCESS"}
            </div>
            <h1>{signup ? "Create your edge." : "Welcome back."}</h1>
            <p>
              {signup
                ? "Start building disciplined market judgment with verified research and focused education."
                : "Sign in to continue your courses, saved research, and private trading workspace."}
            </p>
            <AuthForm mode={mode} />
            <div className="auth-assurance">
              <span>
                <ShieldCheck size={15} /> Encrypted access
              </span>
              <span>Private by default</span>
            </div>
          </div>
          <footer className="auth-footer">
            <span>
              {signup ? "Already a member?" : "New to EdgeLedger?"}{" "}
              <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link>
            </span>
            <Link href="/">Terms & privacy</Link>
          </footer>
        </div>

        <div className="auth-media" aria-label="EdgeLedger platform walkthrough">
          <div className="auth-media-canvas" />
          <div className="auth-video-shade" />
          <div className="auth-embed-shell">
            <ScreenPalLoopPlayer />
          </div>
          <Link href="/" className="auth-close" aria-label="Return to landing page">
            <X size={19} />
          </Link>
          <div className="auth-signal-card">
            <span>
              <i /> MARKET SIGNAL
            </span>
            <strong>
              EUR / USD <em>+0.65%</em>
            </strong>
            <div>
              <b style={{ height: "34%" }} />
              <b style={{ height: "48%" }} />
              <b style={{ height: "42%" }} />
              <b style={{ height: "61%" }} />
              <b style={{ height: "53%" }} />
              <b style={{ height: "76%" }} />
              <b style={{ height: "70%" }} />
              <b style={{ height: "90%" }} />
            </div>
          </div>
          <div className="auth-proof-card">
            <span>
              <TrendingUp size={16} /> VERIFIED RESEARCH
            </span>
            <strong>24,180</strong>
            <small>trades logged and reviewed</small>
            <ArrowUpRight size={16} />
          </div>
        </div>
      </div>
    </section>
  );
}
