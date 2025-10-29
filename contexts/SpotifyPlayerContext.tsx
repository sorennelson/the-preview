"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayerContextType {
  player: any;
  deviceId: string | null;
  isReady: boolean;
  isInitializing: boolean;
  error: string | null;
  currentTrack: { name?: string; artist?: string; index?: number };
  paused: boolean;
  playTracks: (trackUris: string[], startIndex?: number) => Promise<void>;
  togglePlay: (trackUris: string[]) => void;
  nextTrack: (trackUris: string[]) => void;
  previousTrack: (trackUris: string[]) => void;
  currentPlayingId: string | null;
  setCurrentPlayingId: (id: string | null) => void;
  trackIndex: number | null;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextType | null>(null);

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken;

  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<{ name?: string; artist?: string; index?: number }>({});
  const [paused, setPaused] = useState(true);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState<number | null>(null);

  const initializingRef = useRef(false);

  // preload SDK
  useEffect(() => {
    if (window.Spotify || document.querySelector('script[src*="spotify-player"]')) return;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => setError("Failed to load Spotify SDK");
    document.body.appendChild(script);
  }, []);

  // init player
  useEffect(() => {
    if (!accessToken || player || initializingRef.current) return;
    initializingRef.current = true;
    setIsInitializing(true);

    const initPlayer = () => {
      if (!window.Spotify) {
        setError("Spotify SDK not loaded");
        setIsInitializing(false);
        return;
      }

      const spotifyPlayer = new window.Spotify.Player({
        name: "The Preview",
        getOAuthToken: (cb: (token: string) => void) => cb(accessToken),
        volume: 0.7,
      });

      spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setPlayer(spotifyPlayer);
        setIsReady(true);
        setIsInitializing(false);
      });

      spotifyPlayer.addListener("not_ready", () => setIsReady(false));
      spotifyPlayer.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setPaused(state.paused);
        const current = state.track_window.current_track;
        if (current) {
          setCurrentTrack({
            name: current.name,
            artist: current.artists.map((a: any) => a.name).join(", "),
          });
        }
      });

      spotifyPlayer.addListener("initialization_error", ({ message }: any) => setError(`Init error: ${message}`));
      spotifyPlayer.addListener("authentication_error", ({ message }: any) => setError(`Auth error: ${message}`));
      spotifyPlayer.addListener("account_error", ({ message }: any) => setError(`Account error: ${message}`));

      spotifyPlayer.connect();
      spotifyPlayer.activateElement();
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      if (player) player.disconnect();
    };
  }, [accessToken]);

  // full playback call with queue
  const playTracks = async (trackUris: string[], startIndex = 0) => {
    if (!deviceId || !accessToken) return;

    // Set track index for the frontend
    setTrackIndex(startIndex);

    const tryPlayTrack = async (index: number): Promise<void> => {
      const trackUri = trackUris[index];
      
      try {
        // ensure device active
        await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_ids: [deviceId], play: false }),
        });

        // start playback with current track
        const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [trackUri] }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.log(`Track ${index} failed, skipping to next:`, errorText);

          // If we're at the final index, don't continue further
          if (index + 1 >= trackUris.length) {
            setError("No more tracks to play");
            return;
          }
          
          // Update track index and try next track
          setTrackIndex(index + 1);
          await tryPlayTrack(index + 1);
        } else {
          setError(null);
        }
      } catch (err) {
        console.log(`Track ${index} error, skipping to next:`, err);

        // If we're at the final index, don't continue further
        if (index + 1 >= trackUris.length) {
          setError("No more tracks to play");
          return;
        }
        
        // Update track index and try next track
        setTrackIndex(index + 1);
        await tryPlayTrack(index + 1);
      }
    };

    await tryPlayTrack(startIndex);
  };

  const togglePlay = (trackUris: string[]) => {
    setPaused(!paused);
    player?.togglePlay();
  };
  const nextTrack = (trackUris: string[]) => {
    // player?.nextTrack();
    playTracks(trackUris, Math.min(trackUris.length-1, (trackIndex || 0) + 1));
    if (trackIndex !== null) {
      setTrackIndex(Math.min(trackUris.length-1, trackIndex + 1));
    }
  };
  const previousTrack = (trackUris: string[]) => {
    // player?.previousTrack();
    playTracks(trackUris, Math.max(0, (trackIndex || 0) - 1));
    if (trackIndex !== null) {
      setTrackIndex(Math.max(0, trackIndex - 1));
    }
  };

  const value = {
    player,
    deviceId,
    isReady,
    isInitializing,
    error,
    currentTrack,
    paused,
    playTracks,
    togglePlay,
    nextTrack,
    previousTrack,
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
