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

  const setPositions = useCallback((updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    if (typeof updater === 'function') {
      positionsRef.current = updater(positionsRef.current);
    } else {
      positionsRef.current = updater;
    }
  }, []);

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