"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

// A recording of the dashboard that plays over its poster. The first frame of the video is the
// poster, so nothing jumps when it starts. It plays only while it is on screen and the tab is
// visible, and it never plays under reduced motion or when the browser asks to save data. It is
// always rendered and hidden with CSS, so the server and the client markup match.
export default function DashboardVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    let onScreen = false;
    const sync = () => {
      if (onScreen && !document.hidden) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    document.addEventListener("visibilitychange", sync);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [reduceMotion]);

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      preload="none"
      tabIndex={-1}
      aria-hidden="true"
      disablePictureInPicture
      disableRemotePlayback
      onPlaying={() => setPlaying(true)}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-150 ease-out motion-reduce:hidden",
        playing ? "opacity-100" : "opacity-0",
      )}
    >
      <source src="/landing/dashboard-demo.mp4" type="video/mp4" />
    </video>
  );
}
