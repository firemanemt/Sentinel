import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Music,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

export default function SpotifyWindow() {
  const [searchQuery, setSearchQuery] = useState("");
  const [volume, setVolume] = useState(50);

  const { data: status } = trpc.sentinel.spotifyStatus.useQuery(undefined, {
    refetchInterval: 5_000,
  });

  const { data: nowPlaying, isLoading: npLoading, refetch: refetchNP } =
    trpc.sentinel.spotifyNowPlaying.useQuery(undefined, {
      refetchInterval: 5_000,
    });

  const playMutation = trpc.sentinel.spotifyPlay.useMutation({
    onSuccess: () => setTimeout(() => refetchNP(), 1000),
  });
  const pauseMutation = trpc.sentinel.spotifyPause.useMutation({
    onSuccess: () => setTimeout(() => refetchNP(), 1000),
  });
  const skipMutation = trpc.sentinel.spotifySkip.useMutation({
    onSuccess: () => setTimeout(() => refetchNP(), 1000),
  });
  const prevMutation = trpc.sentinel.spotifyPrevious.useMutation({
    onSuccess: () => setTimeout(() => refetchNP(), 1000),
  });
  const volumeMutation = trpc.sentinel.spotifyVolume.useMutation();

  const handleVolumeCommit = (v: number) => volumeMutation.mutate({ volume: v });

  const isPlaying = nowPlaying?.playing ?? false;
  const track = nowPlaying?.track;

  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1DB954] flex items-center justify-center">
            <Music className="w-8 h-8 text-black" />
          </div>
          <h3 className="text-lg font-semibold">Connect Spotify</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Spotify requires OAuth authorization. Use the SENTINEL chat to say{" "}
            <strong>"connect Spotify"</strong> or ask SENTINEL to play music — it will guide you
            through the authorization flow.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <a
            href="https://accounts.spotify.com/authorize"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#1DB954] underline underline-offset-2 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Open Spotify
          </a>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Tip: Tell SENTINEL "play Highway to Hell" or "play some jazz" and it will handle
            the rest once connected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "rgba(10,25,47,0.95)", color: "#e0e0e0" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(29,185,84,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Music style={{ width: 16, height: 16, color: "#1DB954" }} />
          <span style={{ fontSize: "14px", fontWeight: "bold", color: "#1DB954", fontFamily: "monospace" }}>
            SPOTIFY
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchNP()}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Now Playing */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: "20px" }}>
        {npLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%" }}>
            <Skeleton className="w-40 h-40 rounded-lg" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : track ? (
          <>
            {/* Album Art */}
            {track.albumArt ? (
              <img
                src={track.albumArt}
                alt={track.album}
                style={{ width: 160, height: 160, borderRadius: "8px", boxShadow: "0 8px 32px rgba(29,185,84,0.3)" }}
              />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "8px",
                  backgroundColor: "rgba(29,185,84,0.1)",
                  border: "1px solid rgba(29,185,84,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Music style={{ width: 48, height: 48, color: "#1DB954", opacity: 0.5 }} />
              </div>
            )}

            {/* Track Info */}
            <div style={{ textAlign: "center", width: "100%" }}>
              <p style={{ fontSize: "16px", fontWeight: "bold", color: "#e0e0e0", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {track.name}
              </p>
              <p style={{ fontSize: "13px", color: "rgba(0,200,255,0.6)", marginBottom: "2px" }}>
                {track.artist}
              </p>
              <p style={{ fontSize: "11px", color: "rgba(0,200,255,0.3)" }}>
                {track.album}
              </p>
            </div>

            {/* Progress */}
            {track.durationMs > 0 && (
              <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)", minWidth: "32px" }}>
                  {Math.floor(track.progressMs / 60000)}:{String(Math.floor((track.progressMs % 60000) / 1000)).padStart(2, "0")}
                </span>
                <div style={{ flex: 1, height: "3px", backgroundColor: "rgba(0,200,255,0.15)", borderRadius: "2px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(track.progressMs / track.durationMs) * 100}%`,
                      backgroundColor: "#1DB954",
                      borderRadius: "2px",
                      transition: "width 1s linear",
                    }}
                  />
                </div>
                <span style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)", minWidth: "32px", textAlign: "right" }}>
                  {Math.floor(track.durationMs / 60000)}:{String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, "0")}
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", color: "rgba(0,200,255,0.4)" }}>
            <Music style={{ width: 48, height: 48, margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: "13px" }}>Nothing playing</p>
            <p style={{ fontSize: "11px", marginTop: "4px", opacity: 0.6 }}>
              Ask SENTINEL to play something
            </p>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => prevMutation.mutate()}
            disabled={prevMutation.isPending}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(0,200,255,0.7)",
              padding: "8px",
              borderRadius: "50%",
              transition: "all 0.15s",
            }}
            title="Previous"
          >
            <SkipBack style={{ width: 20, height: 20 }} />
          </button>

          <button
            onClick={() => isPlaying ? pauseMutation.mutate() : playMutation.mutate()}
            disabled={playMutation.isPending || pauseMutation.isPending}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              backgroundColor: "#1DB954",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(29,185,84,0.4)",
              transition: "all 0.15s",
            }}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause style={{ width: 22, height: 22, color: "#000" }} />
            ) : (
              <Play style={{ width: 22, height: 22, color: "#000", marginLeft: "2px" }} />
            )}
          </button>

          <button
            onClick={() => skipMutation.mutate()}
            disabled={skipMutation.isPending}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(0,200,255,0.7)",
              padding: "8px",
              borderRadius: "50%",
              transition: "all 0.15s",
            }}
            title="Skip"
          >
            <SkipForward style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Volume */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}>
          <Volume2 style={{ width: 14, height: 14, color: "rgba(0,200,255,0.5)", flexShrink: 0 }} />
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={5}
            className="flex-1"
            onValueChange={([v]) => setVolume(v)}
            onValueCommit={([v]) => handleVolumeCommit(v)}
          />
          <span style={{ fontSize: "11px", color: "rgba(0,200,255,0.4)", minWidth: "28px", textAlign: "right" }}>
            {volume}%
          </span>
        </div>

        {/* Quick search */}
        <div style={{ width: "100%", display: "flex", gap: "8px" }}>
          <Input
            placeholder="Ask SENTINEL to play…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                playMutation.mutate();
                setSearchQuery("");
              }
            }}
            className="text-sm h-8"
            style={{ backgroundColor: "rgba(0,100,150,0.1)", border: "1px solid rgba(0,200,255,0.2)", color: "#e0e0e0" }}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            style={{ backgroundColor: "#1DB954" }}
            onClick={() => {
              if (searchQuery.trim()) {
                playMutation.mutate();
                setSearchQuery("");
              }
            }}
            disabled={!searchQuery.trim() || playMutation.isPending}
          >
            <Play className="w-3.5 h-3.5 text-black" />
          </Button>
        </div>
      </div>
    </div>
  );
}
