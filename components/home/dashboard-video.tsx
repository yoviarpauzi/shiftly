"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { DashboardVideoProps } from "@/types/home";
import { cn } from "cn";

// A recording of the app that plays over its poster. The first frame of the video is the
// poster, so nothing jumps when it starts. It plays only while it is on screen and the tab is
// visible, and it never plays under reduced motion or when the browser asks to save data. It is
// always rendered and hidden with CSS, so the server and the client markup match. A visitor can
// pause it from outside (`paused`), and then it stays paused until they play it again.
//
// "On screen" is judged on the frame that clips the video, the closest ancestor marked
// `data-video-frame`, and not on the video's own box. A recording is drawn larger than its frame
// and only a crop of it shows, so on a phone as little as a tenth of the video's box is visible
// even when the whole frame is. Watching the video itself would never reach any sensible share.
export default function DashboardVideo({ src, paused = false, onStart }: DashboardVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const reduceMotion = useReducedMotion();

  // The observer below outlives a pause, so it reads the latest value from here and the pause
  // effect asks it to re-evaluate. Toggling pause then never rebuilds the observer or the listener.
  const pausedRef = useRef(paused);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current();
  }, [paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    let onScreen = false;
    const sync = () => {
      if (onScreen && !document.hidden && !pausedRef.current) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };
    syncRef.current = sync;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.35 },
    );

    observer.observe(video.closest("[data-video-frame]") ?? video);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      syncRef.current = () => {};
      video.pause();
    };
  }, [reduceMotion]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      tabIndex={-1}
      aria-hidden="true"
      disablePictureInPicture
      disableRemotePlayback
      onPlaying={() => {
        setPlaying(true);
        onStart?.();
      }}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-150 ease-out motion-reduce:hidden",
        playing ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
