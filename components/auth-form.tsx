"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";

export function AuthForm({ mode = "login", vip = false }: { mode?: "login" | "signup"; vip?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("error") || "";
  });
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      if (mode === "signup") {
        const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to create your account.");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok) throw new Error(mode === "signup" ? "Account created, but sign-in failed." : "Email or password is incorrect.");
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
      router.push(callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  const callbackUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("callbackUrl") || "" : "";

  return <form onSubmit={submit} className="auth-form-shell">
    <a className="auth-google" href={`/api/google-drive/connect?mode=login${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} aria-label="Continue with Google">
      <span>G</span> Continue with Google
    </a>
    <div className="auth-divider"><span>or use email</span></div>
    <label className="auth-field"><span>Email address</span><div><Mail size={17} /><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} aria-invalid={!!error && !email.includes("@")} /></div></label>
    <label className="auth-field"><span>Password</span><div><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Minimum 8 characters" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
    {vip && <label className="auth-field"><span>Private access code</span><div><KeyRound size={17} /><input value={accessCode} onChange={event => setAccessCode(event.target.value)} placeholder="Enter access code" /></div></label>}
    <div className="auth-options"><label><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><i /> Keep me signed in</label><span><LockKeyhole size={12} /> Protected session</span></div>
    <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? "Securing access…" : mode === "signup" ? "Create secure account" : vip ? "Enter private desk" : "Sign in to your desk"}</span>{loading ? <LoaderCircle className="spin" size={18} /> : <i><ArrowRight size={18} /></i>}</button>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </form>;
}
