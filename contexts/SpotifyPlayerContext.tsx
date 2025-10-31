"use client"

import { useRef, useState, useEffect, createContext, useContext, ReactNode } from 'react';

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
}

const SpotifyEmbedContext = createContext<SpotifyEmbedContextType | null>(null);

export function SpotifyEmbedProvider({ children }: { children: ReactNode }) {
  const [controller, setController] = useState<any>(null);
  const [paused, setPaused] = useState(true);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [totalTracks, setTotalTracks] = useState(0);
  const [currentTrackUris, setCurrentTrackUris] = useState<string[]>([]);

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
