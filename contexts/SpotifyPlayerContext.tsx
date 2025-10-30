"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface SpotifyPlayerContextType {
  activeDeviceId: string | null;
  availableDevices: any[];
  currentTrack: { name?: string; artist?: string } | null;
  error: string | null;
  paused: boolean;
  isFetching: boolean;
  playTracks: (trackUris: string[], startIndex?: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: (trackUris: string[]) => Promise<void>;
  previousTrack: (trackUris: string[]) => Promise<void>;
  refreshDevices: () => Promise<void>;
  currentPlayingId: string | null;
  setCurrentPlayingId: (id: string | null) => void;
  trackIndex: number | null;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextType | null>(null);

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken;

  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<{ name?: string; artist?: string } | null>(null);
  const [paused, setPaused] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState<number | null>(null);

  // Fetch user's Spotify devices
  const fetchDevices = async () => {
    if (!accessToken) return;
    setIsFetching(true);
    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setAvailableDevices(data.devices || []);

      const active = data.devices?.find((d: any) => d.is_active);
      setActiveDeviceId(active ? active.id : null);
    } catch (err) {
      setError("Failed to fetch devices");
    } finally {
      setIsFetching(false);
    }
  };

  // Fetch current track info
  const fetchCurrentPlayback = async () => {
    if (!accessToken) return;
    const res = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  
    if (res.status === 204) return; // no playback
    const data = await res.json();
  
    // If full item exists
    if (data?.item) {
      if (data.currently_playing_type === "episode") {
        const ep = data.item;
        setCurrentTrack({
          name: ep.name,
          artist: ep.show?.publisher || ep.show?.name,
        });
        // setPaused(!data.is_playing);
        return;
      }
      if (data.currently_playing_type === "track") {
        const track = data.item;
        setCurrentTrack({
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(", "),
        });
        // setPaused(!data.is_playing);
        return;
      }
    }
  
    // If item is null, but there’s a progress or timestamp, attempt fallback
    if (data?.currently_playing_type === "episode" && !data.item) {
      try {
        // Use the "queue" endpoint as last resort
        const qRes = await fetch("https://api.spotify.com/v1/me/player/queue", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const qData = await qRes.json();
  
        if (qData?.currently_playing?.type === "episode") {
          const epId = qData.currently_playing.uri.split(":")[2];
          const epRes = await fetch(`https://api.spotify.com/v1/episodes/${epId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const ep = await epRes.json();
          setCurrentTrack({
            name: ep.name,
            artist: ep.show?.name || ep.show?.publisher,
          });
          // setPaused(false);
          return;
        }
      } catch {
        // setError("Unable to resolve current episode");
        console.log("Unable to resolve current episode");
      }
    }
    // setPaused(true);
  };
  

  // Initialize polling every 15 seconds
  useEffect(() => {
    if (!accessToken) return;
    fetchDevices();
    fetchCurrentPlayback();
    const interval = setInterval(() => {
      fetchDevices();
      fetchCurrentPlayback();
    }, paused ? 10000 : 3000);
    return () => clearInterval(interval);
  }, [accessToken, paused]);

  // Ensure user has an active Spotify client open
  const ensureActiveDevice = async () => {
    await fetchDevices();
    if (!activeDeviceId) {
      setError("No active Spotify device found. Open Spotify and start playback first.");
      throw new Error("No active device");
    }
  };

  const playTracks = async (trackUris: string[], startIndex = 0) => {
    if (!accessToken || !trackUris.length) return;
    await ensureActiveDevice();

    // disable shuffle
    await fetch(
      `https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${activeDeviceId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  
    const tryPlay = async (index: number): Promise<void> => {
      // stop if index is out of bounds
      if (index >= trackUris.length) {
        // setError("Reached end of track list");
        return;
      }

      setTrackIndex(index);
  
      const uris = trackUris.slice(index);
  
      try {  
        // attempt playback
        const res = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${activeDeviceId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris }),
          }
        );
  
        if (!res.ok) {
          console.log(`Track ${index} failed: ${res.status}`);
          // next track, but clamp index
          const nextIndex = Math.min(index + 1, trackUris.length - 1);
          if (nextIndex > index) await tryPlay(nextIndex);
          else setError("No more tracks to play");
        } else {
          setPaused(false);
          await fetchCurrentPlayback();
          setError(null);
        }
      } catch (err) {
        console.error(`Track ${index} error`, err);
        const nextIndex = Math.min(index + 1, trackUris.length - 1);
        if (nextIndex > index) await tryPlay(nextIndex);
        else setError("No more tracks to play");
      }
    };
  
    await tryPlay(startIndex);
  };
  

  const togglePlay = async () => {
    if (!accessToken) return;
    try {
      await ensureActiveDevice();
      const endpoint = paused ? "play" : "pause";
      await fetch(`https://api.spotify.com/v1/me/player/${endpoint}?device_id=${activeDeviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setPaused(!paused);
    } catch (err) {
      console.error(err);
    }
  };

  const nextTrack = async (trackUris: string[]) => {
    if (!accessToken) return;
    try {
      await ensureActiveDevice();
      await playTracks(trackUris, (trackIndex ?? -1) + 1)
      setPaused(false);
      await fetchCurrentPlayback();
    } catch (err) {
      console.error(err);
    }
  };

  const previousTrack = async (trackUris: string[]) => {
    if (!accessToken) return;
    try {
      await ensureActiveDevice();
      await playTracks(trackUris, (trackIndex ?? 1) - 1)
      setPaused(false);
      await fetchCurrentPlayback();
    } catch (err) {
      console.error(err);
    }
  };

  const value = {
    activeDeviceId,
    availableDevices,
    currentTrack,
    error,
    paused,
    isFetching,
    playTracks,
    togglePlay,
    nextTrack,
    previousTrack,
    refreshDevices: fetchDevices,
    currentPlayingId,
    setCurrentPlayingId,
    trackIndex
  };

  return <SpotifyPlayerContext.Provider value={value}>{children}</SpotifyPlayerContext.Provider>;
}

export function useSpotifyPlayer() {
  const context = useContext(SpotifyPlayerContext);
  if (!context) throw new Error("useSpotifyPlayer must be used within SpotifyPlayerProvider");
  return context;
}
