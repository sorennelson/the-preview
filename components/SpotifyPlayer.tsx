"use client";

import { Button } from "@/components/ui/button";
import { useSpotifyPlayer } from "@/contexts/SpotifyPlayerContext";
import { ChevronLast, ChevronFirst, Play, Pause } from 'lucide-react';

interface SpotifyPlayerProps {
  trackUris: string[];
  playlistId: string; // Unique ID for this playlist
}

export default function SpotifyPlayer({ trackUris, playlistId }: SpotifyPlayerProps) {
  const {
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
  } = useSpotifyPlayer();

  const isThisPlaying = currentPlayingId === playlistId;

  const handlePlay = async () => {
    if (isThisPlaying) {
      togglePlay(trackUris);
    } else {
      setCurrentPlayingId(playlistId);
      await playTracks(trackUris, 0);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  // Show different messages based on state
  if (isInitializing) {
    return (
      <div className="flex items-center gap-2 mt-4 justify-center">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
        <p className="text-sm text-gray-500">Connecting to Spotify...</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center gap-2 mt-4 justify-center">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
        <p className="text-sm text-gray-500">Waiting for player...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {isThisPlaying && (
        <div className="text-center text-sm text-gray-500 mb-2">
          <p className="font-semibold">{currentTrack.name || "Loading..."}</p>
          <p className="text-xs">{currentTrack.artist}</p>
        </div>
      )}
      
      <div className="flex gap-2">
        {isThisPlaying && (
          <>
            <Button className="rounded-full" variant="outline" onClick={() => previousTrack(trackUris)} size="sm">
              <ChevronFirst className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button className="rounded-full w-20" variant="outline" onClick={() => handlePlay()} size="sm">
          { isThisPlaying ? 
            ( paused ? 
              <Play className="h-4 w-4" /> : 
              <Pause className="h-4 w-4" />
            ) : 
            <Play className="h-4 w-4" />
          }
        </Button>
        {isThisPlaying && (
          <Button className="rounded-full" variant="outline" onClick={() => nextTrack(trackUris)} size="sm">
            <ChevronLast className="h-4 w-4" />
          </Button>
        )}
      </div>
      {isThisPlaying && trackIndex !== null && (
        <p className="text-xs text-gray-500 mt-2">
          Track {trackIndex + 1} of {trackUris.length}
        </p>
      )}
    </div>
  );
}
