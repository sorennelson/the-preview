"use client"

import { useRef, useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';

interface SpotifyEmbedContextType {
  controller: any;
  setController: (controller: any) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  currentPlayingId: string | null;
  setCurrentPlayingId: (id: string | null) => void;
  trackIndex: number;
  setTrackIndex: (index: number) => void;
  totalTracks: number;
  setTotalTracks: (total: number) => void;
  currentTrackUris: string[];
  setCurrentTrackUris: (uris: string[]) => void;
  pendingPlay: boolean;
  setPendingPlay: (pending: boolean) => void;
  positionsRef: React.MutableRefObject<Record<string, number>>;
  setPositions: (
    updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)
  ) => void;
  togglePlay: () => void;
  playTrack: (index: number, uris?: string[]) => void;
}

const SpotifyEmbedContext = createContext<SpotifyEmbedContextType | null>(null);

export function SpotifyEmbedProvider({ children }: { children: ReactNode }) {
  const [controller, setController] = useState<any>(null);
  const [paused, setPaused] = useState(true);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [totalTracks, setTotalTracks] = useState(0);
  const [currentTrackUris, setCurrentTrackUris] = useState<string[]>([]);
  const [pendingPlay, setPendingPlay] = useState(false);

  const positionsRef = useRef<Record<string, number>>({});
  const currentTrackUrisRef = useRef<string[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentTrackUrisRef.current = currentTrackUris;
  }, [currentTrackUris]);

  // Handle pending play when controller becomes available
  useEffect(() => {
    if (controller && pendingPlay && currentTrackUris.length > 0 && currentTrackUris[trackIndex]) {
      console.log('Executing pending play:', trackIndex);
      
      try {
        const loadResult = controller.loadUri(currentTrackUris[trackIndex]);
        
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
          controller.play();
          setPaused(false);
          setPendingPlay(false);
        }
      } catch (err) {
        console.error('Error in pending play:', err);
        setPendingPlay(false);
      }
    }
  }, [controller, pendingPlay, currentTrackUris]);;

  const setPositions = useCallback((updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    if (typeof updater === 'function') {
      positionsRef.current = updater(positionsRef.current);
    } else {
      positionsRef.current = updater;
    }
  }, []);

  const playTrack = useCallback((index: number, uris?: string[]) => {
    const trackUris = uris || currentTrackUrisRef.current;
    console.log('playTrack called:', { index, hasController: !!controller, trackUris: trackUris.length });
    
    if (index < 0 || index >= trackUris.length) {
      console.error('Invalid track index:', index);
      return;
    }

    setTrackIndex(index);

    if (controller) {
      try {
        const loadResult = controller.loadUri(trackUris[index]);
        
        if (loadResult && typeof loadResult.then === 'function') {
          loadResult.then(() => {
            controller.play();
            setPaused(false);
          }).catch((err: any) => {
            console.error('Error loading track:', err);
          });
        } else {
          controller.play();
          setPaused(false);
        }
      } catch (err) {
        console.error('Error playing track:', err);
      }
    } else {
      console.log('No controller yet, setting pending play');
      setPendingPlay(true);
    }
  }, [controller, setTrackIndex, setPaused, setPendingPlay]);

  const togglePlay = useCallback(() => {
    if (controller) {
      controller.togglePlay();
    }
  }, [controller]);

  const value = {
    controller,
    setController,
    paused,
    setPaused,
    currentPlayingId,
    setCurrentPlayingId,
    trackIndex,
    setTrackIndex,
    totalTracks,
    setTotalTracks,
    currentTrackUris,
    setCurrentTrackUris,
    pendingPlay,
    setPendingPlay,
    positionsRef,
    setPositions,
    playTrack,
    togglePlay,
  };

  return (
    <SpotifyEmbedContext.Provider value={value}>
      {children}
    </SpotifyEmbedContext.Provider>
  );
}

export function useSpotifyEmbed() {
  const context = useContext(SpotifyEmbedContext);
  if (!context) {
    throw new Error('useSpotifyEmbed must be used within SpotifyEmbedProvider');
  }
  return context;
}