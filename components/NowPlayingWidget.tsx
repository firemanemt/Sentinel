import { useState } from "react";
import { Music2, Pause, Play, SkipForward, SkipBack } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface NowPlayingTrack {
  name: string;
  artist: string;
  album: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

interface NowPlayingWidgetProps {
  track: NowPlayingTrack | null;
  playing: boolean;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function NowPlayingWidget({ track, playing }: NowPlayingWidgetProps) {
  const hudBorder = "1px solid oklch(0.22 0.05 210 / 0.5)";
  const accent = "#00ccee";
  const dimAccent = "#00ccee44";
  const spotifyGreen = "#1DB954";

  const utils = trpc.useUtils();

  // Optimistic isPlaying state
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const isCurrentlyPlaying = optimisticPlaying !== null ? optimisticPlaying : (track?.isPlaying ?? false);

  const invalidateNowPlaying = () => {
    // Refresh after a short delay to let Spotify update
    setTimeout(() => {
      void utils.sentinel.spotifyNowPlaying.invalidate();
      setOptimisticPlaying(null);
    }, 800);
  };

  const playMutation = trpc.sentinel.spotifyPlay.useMutation({
    onMutate: () => setOptimisticPlaying(true),
    onSettled: invalidateNowPlaying,
  });

  const pauseMutation = trpc.sentinel.spotifyPause.useMutation({
    onMutate: () => setOptimisticPlaying(false),
    onSettled: invalidateNowPlaying,
  });

  const skipMutation = trpc.sentinel.spotifySkip.useMutation({
    onSettled: () => {
      setOptimisticPlaying(null);
      setTimeout(() => void utils.sentinel.spotifyNowPlaying.invalidate(), 600);
    },
  });

  const previousMutation = trpc.sentinel.spotifyPrevious.useMutation({
    onSettled: () => {
      setOptimisticPlaying(null);
      setTimeout(() => void utils.sentinel.spotifyNowPlaying.invalidate(), 600);
    },
  });

  const isLoading =
    playMutation.isPending ||
    pauseMutation.isPending ||
    skipMutation.isPending ||
    previousMutation.isPending;

  const handlePlayPause = () => {
    if (isLoading) return;
    if (isCurrentlyPlaying) {
      pauseMutation.mutate();
    } else {
      playMutation.mutate();
    }
  };

  const handleSkip = () => {
    if (isLoading) return;
    skipMutation.mutate();
  };

  const handlePrevious = () => {
    if (isLoading) return;
    previousMutation.mutate();
  };

  if (!playing || !track) {
    return (
      <div
        className="rounded-sm p-2 flex items-center gap-2 opacity-40"
        style={{ border: hudBorder, background: "oklch(0.06 0.01 220)" }}
      >
        <Music2 size={12} style={{ color: dimAccent, flexShrink: 0 }} />
        <span className="text-xs font-mono truncate" style={{ color: dimAccent }}>
          SPOTIFY — NOTHING PLAYING
        </span>
      </div>
    );
  }

  const progressPct = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;

  const controlBtnStyle = (color: string): React.CSSProperties => ({
    background: "transparent",
    border: "none",
    cursor: isLoading ? "not-allowed" : "pointer",
    padding: "3px",
    borderRadius: "2px",
    color,
    opacity: isLoading ? 0.4 : 0.85,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 150ms ease-out, transform 100ms ease-out",
  });

  return (
    <div
      className="rounded-sm p-2 flex flex-col gap-1.5"
      style={{
        border: `1px solid ${spotifyGreen}44`,
        background: "oklch(0.06 0.01 220)",
        boxShadow: `0 0 10px ${spotifyGreen}18`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5">
        {isCurrentlyPlaying ? (
          <Play size={10} style={{ color: spotifyGreen, flexShrink: 0 }} />
        ) : (
          <Pause size={10} style={{ color: accent, flexShrink: 0 }} />
        )}
        <span className="text-xs font-mono tracking-widest" style={{ color: spotifyGreen, fontSize: "9px" }}>
          {isCurrentlyPlaying ? "NOW PLAYING" : "PAUSED"}
        </span>
      </div>

      {/* Album art + track info */}
      <div className="flex items-center gap-2">
        {track.albumArt ? (
          <img
            src={track.albumArt}
            alt={track.album}
            className="rounded-sm flex-shrink-0"
            style={{ width: 36, height: 36, objectFit: "cover", border: `1px solid ${spotifyGreen}33` }}
          />
        ) : (
          <div
            className="rounded-sm flex-shrink-0 flex items-center justify-center"
            style={{ width: 36, height: 36, background: "oklch(0.12 0.02 220)", border: hudBorder }}
          >
            <Music2 size={14} style={{ color: dimAccent }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div
            className="text-xs font-mono truncate font-semibold"
            style={{ color: accent, fontSize: "10px" }}
            title={track.name}
          >
            {track.name}
          </div>
          <div
            className="text-xs font-mono truncate"
            style={{ color: dimAccent, fontSize: "9px" }}
            title={track.artist}
          >
            {track.artist}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono flex-shrink-0" style={{ color: dimAccent, fontSize: "8px" }}>
          {formatMs(track.progressMs)}
        </span>
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 2, background: "oklch(0.22 0.05 210 / 0.4)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${progressPct}%`, background: spotifyGreen }}
          />
        </div>
        <span className="text-xs font-mono flex-shrink-0" style={{ color: dimAccent, fontSize: "8px" }}>
          {formatMs(track.durationMs)}
        </span>
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-2 pt-0.5">
        <button
          onClick={handlePrevious}
          title="Previous track"
          style={controlBtnStyle(dimAccent)}
          onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = isLoading ? "0.4" : "0.85"; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.9)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          <SkipBack size={12} />
        </button>

        <button
          onClick={handlePlayPause}
          title={isCurrentlyPlaying ? "Pause" : "Play"}
          style={{
            ...controlBtnStyle(spotifyGreen),
            background: `${spotifyGreen}22`,
            border: `1px solid ${spotifyGreen}44`,
            borderRadius: "50%",
            padding: "5px",
            opacity: isLoading ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = `${spotifyGreen}44`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${spotifyGreen}22`; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.9)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          {isCurrentlyPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <button
          onClick={handleSkip}
          title="Skip track"
          style={controlBtnStyle(dimAccent)}
          onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = isLoading ? "0.4" : "0.85"; }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.9)"; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          <SkipForward size={12} />
        </button>
      </div>
    </div>
  );
}
