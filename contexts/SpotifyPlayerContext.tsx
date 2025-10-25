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
  currentTrack: { name?: string; artist?: string, index?: number };
  paused: boolean;
  playTracks: (trackUris: string[], startIndex?: number) => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  currentPlayingId: string | null;
  setCurrentPlayingId: (id: string | null) => void;
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
  const [currentTrack, setCurrentTrack] = useState<{ name?: string; artist?: string, index?: number }>({});
  const [paused, setPaused] = useState(true);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  
  const initializingRef = useRef(false);
  const currentQueueRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);

  // Pre-load SDK script immediately when component mounts
  useEffect(() => {
    if (window.Spotify || document.querySelector('script[src*="spotify-player"]')) {
      return; // Already loaded
    }

    console.log("Pre-loading Spotify SDK...");
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => setError("Failed to load Spotify SDK");
    document.body.appendChild(script);
  }, []);

  // Initialize player once we have access token
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

      console.log("Initializing global Spotify Player...");
      const spotifyPlayer = new window.Spotify.Player({
        name: "The Preview",
        getOAuthToken: (cb: (token: string) => void) => cb(accessToken),
        volume: 0.7,
      });

      spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("✅ Player ready:", device_id);
        setDeviceId(device_id);
        setPlayer(spotifyPlayer);
        setIsReady(true);
        setIsInitializing(false);
      });

      spotifyPlayer.addListener("not_ready", () => {
        setIsReady(false);
      });

      spotifyPlayer.addListener("player_state_changed", (state: any) => {
        if (!state) return;

        console.log("✅ Player state changed:", state);

        setPaused(state.paused);
        const current = state.track_window.current_track;
        if (current) {
          setCurrentTrack({
            name: current.name,
            artist: current.artists.map((a: any) => a.name).join(", "),
            index: currentIndexRef.current,
          });
        }

        // Auto-advance on track end
        if (state.paused && state.position === 0 && state.track_window.previous_tracks.length > 0) {
          
          console.log("✅ Auto advance:", state);

          const nextIndex = currentIndexRef.current + 1;
          if (nextIndex < currentQueueRef.current.length) {
            currentIndexRef.current = nextIndex;
            playTrackAtIndex(nextIndex);
          }
        }
      });

      spotifyPlayer.addListener("initialization_error", ({ message }: any) => {
        setError(`Initialization error: ${message}`);
        setIsInitializing(false);
      });

      spotifyPlayer.addListener("authentication_error", ({ message }: any) => {
        setError(`Authentication error: ${message}`);
        setIsInitializing(false);
      });

      spotifyPlayer.addListener("account_error", ({ message }: any) => {
        setError(`Account error: ${message}`);
        setIsInitializing(false);
      });

      spotifyPlayer.connect();
      spotifyPlayer.activateElement();
    };

    // Wait for SDK to be ready
    if (window.Spotify) {
      initPlayer();
    } else {
      console.log("Waiting for Spotify SDK to load...");
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      if (player) player.disconnect();
    };
  }, [accessToken]);

  const playTrackAtIndex = async (index: number, retryCount = 0) => {
    if (!deviceId || !accessToken || !currentQueueRef.current[index]) return;
  
    try {
      // First, check current playback state
      const stateRes = await fetch("https://api.spotify.com/v1/me/player", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
  
      let needsTransfer = true;
      if (stateRes.ok && stateRes.status !== 204) {
        const state = await stateRes.json();
        needsTransfer = state.device?.id !== deviceId;
      }
  
      if (needsTransfer) {
        console.log("Transferring playback to device:", deviceId);
        
        // Transfer playback to this device
        const transferRes = await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_ids: [deviceId], play: false }),
        });
        
        if (!transferRes.ok) {
          const errorText = await transferRes.text();
          console.error("Transfer failed:", errorText);
        } else {
          console.log("✅ Transfer successful");
        }
        
        // Wait for device transfer to complete
        await new Promise(r => setTimeout(r, 1500));
      }
      
      // Play the track
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        body: JSON.stringify({
          uris: [currentQueueRef.current[index]],
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      if (!playRes.ok) {
        const errorText = await playRes.text();
        console.error(`Play failed for track ${index}:`, errorText);
        
        // If restriction violated and this is the first attempt, try one retry
        if (errorText.includes("Restriction violated") && retryCount === 0) {
          console.log("Retrying once...");
          await new Promise(r => setTimeout(r, 1000));
          return playTrackAtIndex(index, retryCount + 1);
        }
        
        // If still failing or out of retries, skip to next track
        console.log(`⏭️ Skipping track ${index}, trying next...`);
        const nextIndex = index + 1;
        if (nextIndex < currentQueueRef.current.length) {
          currentIndexRef.current = nextIndex;
          return playTrackAtIndex(nextIndex, 0);
        } else {
          console.log("No more tracks to play");
          setError("No playable tracks available");
        }
      } else {
        console.log(`✅ Track ${index} playing successfully`);
        setError(null);
      }
    } catch (err) {
      console.error("Play error:", err);
      
      // On any error, try to skip to next track
      console.log(`⏭️ Error on track ${index}, trying next...`);
      const nextIndex = index + 1;
      if (nextIndex < currentQueueRef.current.length) {
        currentIndexRef.current = nextIndex;
        return playTrackAtIndex(nextIndex, 0);
      } else {
        setError(`Playback error: No playable tracks`);
      }
    }
  };

  const playTracks = async (trackUris: string[], startIndex = 0) => {
    currentQueueRef.current = trackUris;
    currentIndexRef.current = startIndex;
    await playTrackAtIndex(startIndex);
  };

  const togglePlay = () => {
    if (player) player.togglePlay();
  };

  const nextTrack = () => {
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex < currentQueueRef.current.length) {
      currentIndexRef.current = nextIndex;
      playTrackAtIndex(nextIndex);
    }
  };

  const previousTrack = () => {
    const prevIndex = currentIndexRef.current - 1;
    if (prevIndex >= 0) {
      currentIndexRef.current = prevIndex;
      playTrackAtIndex(prevIndex);
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
  };

  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

export function useSpotifyPlayer() {
  const context = useContext(SpotifyPlayerContext);
  if (!context) {
    throw new Error("useSpotifyPlayer must be used within SpotifyPlayerProvider");
  }
  return context;
}