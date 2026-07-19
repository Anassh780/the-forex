"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

interface SecureVideoPlayerProps {
  videoUrl: string;
  title: string;
  courseId?: string;
  poster?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number) {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hrs > 0
    ? `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    : `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SecureVideoPlayer({ videoUrl, title, poster }: SecureVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [warning, setWarning] = useState("");
  const [streamSrc, setStreamSrc] = useState("");
  const [loadError, setLoadError] = useState("");
  const [authorizing, setAuthorizing] = useState(true);

  const flashWarning = useCallback((text: string) => {
    setWarning(text);
    window.setTimeout(() => setWarning(""), 2600);
  }, []);

  // Progressive streaming (not full-file blob download) keeps startup fast and avoids
  // multi-GB memory spikes. Auth is still session + short-lived stream token.
  const authorizeStream = useCallback(async (preserveTime = false) => {
    const fileId = decodeURIComponent(videoUrl.split("/").pop() || "").split("?")[0];
    if (!fileId) {
      setLoadError("This video is unavailable.");
      setAuthorizing(false);
      return;
    }

    setAuthorizing(true);
    setLoadError("");
    try {
      const tokenRes = await fetch("/api/drive/stream-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
        cache: "no-store",
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Unable to authorize playback.");
      }

      const nextSrc = `${videoUrl}?t=${encodeURIComponent(tokenData.token)}`;
      const video = videoRef.current;
      const resumeAt = preserveTime && video ? video.currentTime : 0;
      const wasPlaying = preserveTime && video ? !video.paused : false;

      setStreamSrc(nextSrc);

      // Refresh token before expiry so long lessons keep streaming.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void authorizeStream(true);
      }, 90 * 60 * 1000);

      if (video && preserveTime) {
        // Let the new src load, then restore position.
        const onLoaded = () => {
          video.currentTime = resumeAt;
          if (wasPlaying) void video.play().catch(() => undefined);
          video.removeEventListener("loadedmetadata", onLoaded);
        };
        video.addEventListener("loadedmetadata", onLoaded);
      }
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Unable to load this video.");
    } finally {
      setAuthorizing(false);
    }
  }, [videoUrl]);

  useEffect(() => {
    void authorizeStream(false);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [authorizeStream]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamSrc) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [streamSrc]);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + delta), video.duration || 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.min(1, Math.max(0, value));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2800);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const withinPlayer = el.contains(document.activeElement) || el.matches(":hover");
      if (!withinPlayer) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(5);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume((videoRef.current?.volume ?? 0) + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume((videoRef.current?.volume ?? 0) - 0.1);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
      }
      revealControls();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, changeVolume, toggleFullscreen, toggleMute, revealControls]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      flashWarning("Download protection is active.");
    };
    const onDrag = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const onKey = (e: KeyboardEvent) => {
      const block = (e.ctrlKey || e.metaKey) && ["s", "u"].includes(e.key.toLowerCase());
      if (block) {
        e.preventDefault();
        flashWarning("Download protection is active.");
      }
    };
    el.addEventListener("contextmenu", onContext);
    el.addEventListener("dragstart", onDrag);
    document.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("contextmenu", onContext);
      el.removeEventListener("dragstart", onDrag);
      document.removeEventListener("keydown", onKey);
    };
  }, [flashWarning]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`evp ${fullscreen ? "evp-fullscreen" : ""} ${controlsVisible || !playing ? "evp-show" : "evp-hide"}`}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      tabIndex={0}
      aria-label={title}
    >
      <video
        ref={videoRef}
        src={streamSrc || undefined}
        poster={poster}
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true);
          revealControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onError={() => {
          if (streamSrc) setLoadError("Playback failed. Reload the lesson and try again.");
        }}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onTimeUpdate={e => {
          setCurrentTime(e.currentTarget.currentTime);
          const b = e.currentTarget.buffered;
          if (b.length) setBuffered(b.end(b.length - 1));
        }}
      />

      {(authorizing || (!streamSrc && !loadError)) && (
        <div className="evp-loading">
          <Loader2 size={38} className="evp-spin" />
          <span>Preparing secure stream…</span>
        </div>
      )}

      {loadError && (
        <div className="evp-loaderror">
          <AlertTriangle size={30} />
          <span>{loadError}</span>
          <button className="evp-retry" type="button" onClick={() => void authorizeStream(false)}>
            Retry
          </button>
        </div>
      )}

      {streamSrc && waiting && !loadError && (
        <div className="evp-spinner">
          <Loader2 size={40} className="evp-spin" />
        </div>
      )}

      {streamSrc && !playing && !waiting && !loadError && (
        <button className="evp-bigplay" onClick={togglePlay} aria-label="Play">
          <Play size={30} fill="currentColor" />
        </button>
      )}

      {warning && (
        <div className="evp-warning">
          <AlertTriangle size={14} /> {warning}
        </div>
      )}

      <div className="evp-title">{title}</div>

      <div className="evp-controls" onClick={e => e.stopPropagation()}>
        <div
          className="evp-seek"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (videoRef.current) videoRef.current.currentTime = ratio * duration;
          }}
        >
          <div className="evp-seek-buffered" style={{ width: `${bufferedPercent}%` }} />
          <div className="evp-seek-played" style={{ width: `${progressPercent}%` }}>
            <span className="evp-seek-knob" />
          </div>
        </div>

        <div className="evp-buttons">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          </button>
          <button onClick={() => seekBy(-10)} aria-label="Back 10 seconds">
            <RotateCcw size={17} />
          </button>
          <button onClick={() => seekBy(10)} aria-label="Forward 10 seconds">
            <RotateCw size={17} />
          </button>

          <div className="evp-volume">
            <button onClick={toggleMute} aria-label="Mute">
              <VolumeIcon size={18} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={e => changeVolume(parseFloat(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <span className="evp-time">
            {formatTime(currentTime)} <em>/</em> {formatTime(duration)}
          </span>

          <div className="evp-spacer" />

          <div className="evp-speed">
            <button onClick={() => setShowSpeed(s => !s)} aria-label="Playback speed">
              <Settings size={17} /> <em>{speed}×</em>
            </button>
            {showSpeed && (
              <div className="evp-speed-menu">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    className={s === speed ? "active" : ""}
                    onClick={() => {
                      if (videoRef.current) videoRef.current.playbackRate = s;
                      setSpeed(s);
                      setShowSpeed(false);
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} aria-label="Fullscreen">
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
