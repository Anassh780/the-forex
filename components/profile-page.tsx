"use client";

import { useSession } from "next-auth/react";
import { ProfileEditor, type ProfileData } from "@/components/profile-editor";
import { CandleLoader } from "@/components/candle-loader";
import { useEffect, useState } from "react";

export function ProfilePage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!session?.user?.email) return;
    setProfile({ name: session.user.name || null, image: session.user.image || null, email: session.user.email });
  }, [session]);

  if (status === "loading" || !profile) return <div className="grid min-h-[45vh] place-items-center"><CandleLoader label="Loading profile" /></div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="eyebrow">Account center</div>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-.04em]">Profile settings</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted">Control the name and profile picture shown across your EdgeLedger workspace.</p>
      </div>
      <ProfileEditor profile={profile} onSaved={setProfile} defaultEditing />
    </div>
  );
}
