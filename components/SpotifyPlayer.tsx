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
    pendingPlay,
    setPendingPlay,
    playTrack,
  } = useSpotifyEmbed();

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
  }, [isThisPlaying, trackUris.length, playlistId, isMounted, setTotalTracks, setCurrentTrackUris]);

  // Effect to handle pending play after controller is ready
  useEffect(() => {
    if (controller && pendingPlay && isThisPlaying && trackUris[trackIndex]) {
      console.log('Executing pending play:', trackIndex);
      
      try {
        // Call loadUri - it may or may not return a promise
        const loadResult = controller.loadUri(trackUris[trackIndex]);
        
        // If it returns a promise, wait for it
        if (loadResult && typeof loadResult.then === 'function') {
          loadResult.then(() => {
            controller.play();
            setPaused(false);
            setPendingPlay(false);
          }).catch((err: any) => {
            console.error('Error loading track:', err);
            setPendingPlay(false);
          });
        } else {
          // Otherwise, just call play immediately
          controller.play();
          setPaused(false);
          setPendingPlay(false);
        }
      } catch (err) {
        console.error('Error in pending play:', err);
        setPendingPlay(false);
      }
    }
  }, [controller, pendingPlay, isThisPlaying, trackIndex, trackUris, setPaused, setPendingPlay]);

  const handlePlay = useCallback(() => {
    console.log('handlePlay called:', { isThisPlaying, playlistId });
    
    if (isThisPlaying && controller) {
      controller.togglePlay();
    } else {
      console.log('Starting new playlist:', playlistId);
      setCurrentPlayingId(playlistId);
      setCurrentTrackUris(trackUris);
      setTotalTracks(trackUris.length);
      setTrackIndex(0);
      
      if (!controller) {
        console.log('Waiting for controller to initialize...');
        setPendingPlay(true);
      } else {
        playTrack(0);
      }
    }
  }, [controller, isThisPlaying, setCurrentPlayingId, playlistId, playTrack, trackUris, setCurrentTrackUris, setTotalTracks, setTrackIndex, setPendingPlay]);

  const handleNext = useCallback(() => {
    if (!isThisPlaying) return;
    const nextIndex = Math.min(trackIndex + 1, trackUris.length - 1);
    playTrack(nextIndex);
  }, [isThisPlaying, trackIndex, trackUris.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (!isThisPlaying) return;
    const prevIndex = Math.max(trackIndex - 1, 0);
    playTrack(prevIndex);
  }, [isThisPlaying, trackIndex, playTrack]);

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