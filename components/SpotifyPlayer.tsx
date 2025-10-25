"use client";

import { Button } from "@/components/ui/button";
import { useSpotifyPlayer } from "@/contexts/SpotifyPlayerContext";

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
  } = useSpotifyPlayer();

  const isThisPlaying = currentPlayingId === playlistId;

  const handlePlay = async () => {
    if (isThisPlaying) {
      togglePlay();
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
        <div className="text-center text-sm text-gray-600 mb-2">
          <p className="font-semibold">{currentTrack.name || "Loading..."}</p>
          <p className="text-xs">{currentTrack.artist}</p>
        </div>
      )}
      
      <div className="flex gap-2">
        {isThisPlaying && (
          <>
            <Button variant="outline" onClick={previousTrack} size="sm">
              Prev
            </Button>
          </>
        )}
        <Button variant="outline" onClick={handlePlay} size="sm">
          {isThisPlaying ? (paused ? "Play" : "Pause") : "Play"}
        </Button>
        {isThisPlaying && (
          <Button variant="outline" onClick={nextTrack} size="sm">
            Next
          </Button>
        )}
      </div>
      {isThisPlaying && currentTrack.index !== undefined && (
        <p className="text-xs text-gray-500 mt-2">
          Track {currentTrack.index + 1} of {trackUris.length}
        </p>
      )}
    </div>
  );
}
