"use client";

import { useCallback, useEffect, useRef } from "react";

const PLAYER_ORIGIN = "https://go.screenpal.com";
const PLAYER_URL = `${PLAYER_ORIGIN}/player/cOiqDFnUmkJ?width=746&height=720&ff=1&title=0&controls=0&m=1&bg=transparent&embed=1&autoplay=1&loop=1`;

type ScreenPalMessage = {
  type?: string;
};

export function ScreenPalLoopPlayer() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const send = useCallback((type: string, values?: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ type, ...values }, PLAYER_ORIGIN);
  }, []);

  const startPlayback = useCallback(() => {
    send("muteVideo");
    send("hideControls");
    send("setVideoTimestamp", { timestamp: 0 });
    send("playVideo");
  }, [send]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ScreenPalMessage>) => {
      if (event.origin !== PLAYER_ORIGIN || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "videoPlayerReady" || event.data?.type === "videoPlayerEnded") startPlayback();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [startPlayback]);

  const handleLoad = () => {
    startPlayback();
    window.setTimeout(startPlayback, 500);
    window.setTimeout(startPlayback, 1500);
  };

  return (
    <iframe
      ref={frameRef}
      title="EdgeLedger platform walkthrough"
      src={PLAYER_URL}
      loading="eager"
      allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={handleLoad}
    />
  );
}
