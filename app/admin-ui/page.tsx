"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AdminConsole } from "@/components/admin-console";
import { CandleLoader } from "@/components/candle-loader";

export default function AdminUiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/admin-ui");
      return;
    }

    if (status === "authenticated" && (session?.user as { role?: string })?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return <div className="container-shell py-16"><CandleLoader size="lg" label="Checking access" /></div>;
  }

  if (status === "authenticated" && (session?.user as { role?: string })?.role !== "admin") {
    return <div className="container-shell py-16"><CandleLoader size="md" label="Redirecting" /></div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return <AdminConsole />;
}
