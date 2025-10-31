"use client";

import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLast, ChevronFirst, Play, Pause } from 'lucide-react';
import { useSpotifyEmbed } from '@/contexts/SpotifyPlayerContext';

interface SpotifyPlayerProps {
  trackUris: string[];
  playlistId: string;
}

export default function SpotifyPlayer({ trackUris, playlistId }: SpotifyPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);
  
  const {
    controller,
    paused,
    currentPlayingId,
    setCurrentPlayingId,
    trackIndex,
    setTrackIndex,
    setTotalTracks,
    setCurrentTrackUris,
    setPaused,
  } = useSpotifyEmbed();

  // Only render on client side to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isThisPlaying = currentPlayingId === playlistId;

  useEffect(() => {
    if (isThisPlaying && isMounted) {
      console.log('Setting track URIs in context:', trackUris);
      setTotalTracks(trackUris.length);
      setCurrentTrackUris(trackUris);
    }
  }, [isThisPlaying, trackUris.length, playlistId, isMounted]);

  const playTrackAtIndex = useCallback(async (index: number) => {
    console.log('playTrackAtIndex called:', { index, hasController: !!controller });
    
    if (index < 0 || index >= trackUris.length) {
      console.error('Invalid track index:', index);
      return;
    }

    // Set the track index FIRST
    setTrackIndex(index);

    // If we have a controller, use it
    if (controller) {
      await controller.loadUri(trackUris[index]);
      await controller.play();
      setPaused(false);
    } else {
      console.log('No controller yet, waiting for embed to initialize');
    }
  }, [controller, trackUris, setTrackIndex, setPaused]);

  const handlePlay = useCallback(async () => {
    console.log('handlePlay called:', { isThisPlaying, playlistId });
    
    if (isThisPlaying && controller) {
      // Already playing this playlist, just toggle
      await controller.togglePlay();
    } else {
      // Start playing this playlist
      console.log('Starting new playlist:', playlistId);
      setCurrentPlayingId(playlistId);
      setCurrentTrackUris(trackUris);
      setTotalTracks(trackUris.length);
      setTrackIndex(0);
      
      // Wait a bit for the embed to initialize if no controller yet
      if (!controller) {
        console.log('Waiting for controller to initialize...');
        setPaused(false);
      } else {
        await playTrackAtIndex(0);
      }
    }
  }, [controller, isThisPlaying, setCurrentPlayingId, playlistId, playTrackAtIndex, trackUris, setCurrentTrackUris, setTotalTracks, setTrackIndex, setPaused]);

  const handleNext = useCallback(async () => {
    if (!isThisPlaying) return;
    const nextIndex = Math.min(trackIndex + 1, trackUris.length - 1);
    await playTrackAtIndex(nextIndex);
  }, [isThisPlaying, trackIndex, trackUris.length, playTrackAtIndex]);

  const handlePrevious = useCallback(async () => {
    if (!isThisPlaying) return;
    const prevIndex = Math.max(trackIndex - 1, 0);
    await playTrackAtIndex(prevIndex);
  }, [isThisPlaying, trackIndex, playTrackAtIndex]);

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          <Button 
            className="rounded-full w-20" 
            variant="outline" 
            size="sm"
            disabled
          >
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {isThisPlaying && (
          <Button 
            className="rounded-full" 
            variant="outline" 
            onClick={handlePrevious} 
            size="sm"
            disabled={trackIndex === 0}
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
        )}
        
        <Button 
          className="rounded-full w-20" 
          variant="outline" 
          onClick={handlePlay} 
          size="sm"
        >
          {isThisPlaying ? 
            (paused ? 
              <Play className="h-4 w-4" /> : 
              <Pause className="h-4 w-4" />
            ) : 
            <Play className="h-4 w-4" />
          }
        </Button>
        
        {isThisPlaying && (
          <Button 
            className="rounded-full" 
            variant="outline" 
            onClick={handleNext} 
            size="sm"
            disabled={trackIndex === trackUris.length - 1}
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}