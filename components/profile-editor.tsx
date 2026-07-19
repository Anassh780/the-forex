"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Camera, Check, Loader2, Trash2, UserRound } from "lucide-react";

export type ProfileData = {
  name: string | null;
  image: string | null;
  email: string;
};

export function ProfileEditor({ profile, onSaved, defaultEditing = false }: { profile: ProfileData; onSaved: (profile: ProfileData) => void; defaultEditing?: boolean }) {
  const { update } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name || profile.email.split("@")[0]);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState(profile.image);
  const [editing, setEditing] = useState(defaultEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!image) {
      setPreview(removeImage ? null : profile.image);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image, profile.image, removeImage]);

  function chooseImage(file?: File) {
    if (!file) return;
    setImage(file);
    setRemoveImage(false);
    setError("");
  }

  function clearImage() {
    setImage(null);
    setRemoveImage(true);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const body = new FormData();
      body.set("name", name);
      body.set("removeImage", String(removeImage));
      if (image) body.set("image", image);
      const response = await fetch("/api/profile", { method: "PUT", body });
      const result = await response.json().catch(() => ({})) as { error?: string; profile?: ProfileData };
      if (!response.ok || !result.profile) throw new Error(result.error || "Unable to update profile.");
      onSaved(result.profile);
      await update({});
      setImage(null);
      setRemoveImage(false);
      setPreview(result.profile.image);
      setEditing(false);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const initial = (name.trim()[0] || profile.email[0] || "U").toUpperCase();

  return (
    <section className="border hairline bg-panel p-6" aria-labelledby="profile-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Profile</div>
          <h2 id="profile-heading" className="mt-2 font-display text-xl">Your identity</h2>
        </div>
        {!editing && (
          <button className="text-[10px] font-bold tracking-wider text-brass hover:underline" onClick={() => setEditing(true)}>
            EDIT
          </button>
        )}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[.04]">
          {preview ? <Image src={preview} alt="Profile preview" fill unoptimized className="object-cover" sizes="80px" /> : <span className="font-display text-3xl text-brass">{initial}</span>}
          {editing && (
            <button aria-label="Choose profile picture" className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition hover:opacity-100" onClick={() => inputRef.current?.click()}>
              <Camera size={20} />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{profile.name || name}</div>
          <div className="mt-1 truncate text-xs text-muted">{profile.email}</div>
          {saved && <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-profit"><Check size={12} /> SAVED</div>}
        </div>
      </div>

      {editing && (
        <div className="mt-6 space-y-4 border-t hairline pt-5">
          <label className="block">
            <span className="text-[10px] font-bold tracking-wider text-muted">DISPLAY NAME</span>
            <input
              aria-label="Display name"
              value={name}
              maxLength={60}
              onChange={event => setName(event.target.value)}
              className="mt-2 w-full rounded-sm border border-white/10 bg-ink px-3 py-2.5 text-sm outline-none focus:border-brass/50"
            />
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            aria-label="Profile picture file"
            onChange={event => chooseImage(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-sm border border-white/15 px-3 py-2 text-[10px] font-bold tracking-wider" onClick={() => inputRef.current?.click()}>
              <Camera size={13} /> CHOOSE PHOTO
            </button>
            {preview && (
              <button className="inline-flex items-center gap-2 rounded-sm border border-loss/25 px-3 py-2 text-[10px] font-bold tracking-wider text-loss" onClick={clearImage}>
                <Trash2 size={13} /> REMOVE
              </button>
            )}
          </div>
          <p className="text-[10px] leading-5 text-muted">JPG, PNG, GIF or WebP. Maximum 5 MB.</p>
          {error && <p role="alert" className="text-xs text-loss">{error}</p>}
          <div className="flex gap-2">
            <button disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-brass px-4 py-2.5 text-[10px] font-bold tracking-wider text-ink disabled:opacity-50" onClick={save}>
              {saving ? <Loader2 size={13} className="opacity-60" /> : <UserRound size={13} />} SAVE PROFILE
            </button>
            <button disabled={saving} className="rounded-sm border border-white/15 px-4 py-2.5 text-[10px] font-bold tracking-wider" onClick={() => { setEditing(false); setName(profile.name || profile.email.split("@")[0]); setImage(null); setRemoveImage(false); setError(""); }}>
              CANCEL
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
