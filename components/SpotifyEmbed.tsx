"use client";

import { useRef, useState, useEffect } from 'react';
import { useSpotifyEmbed } from '@/contexts/SpotifyPlayerContext';
import { useSession } from 'next-auth/react';

declare global {
  interface Window {
    onSpotifyIframeApiReady: (IFrameAPI: any) => void;
    Spotify?: any;
  }
}

export default function SpotifyEmbed() {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken;
  
  const embedRef = useRef<HTMLDivElement>(null);
  const [iFrameAPI, setIFrameAPI] = useState<any>(undefined);
  const [isMounted, setIsMounted] = useState(false);
  const controllerRef = useRef<any>(null);
  
  const { 
    setController, 
    setPaused, 
    trackIndex, 
    currentTrackUris, 
    currentPlayingId, 
    positionsRef, 
    setPositions,
    playTrack,
    totalTracks 
  } = useSpotifyEmbed();

  const currentUri = currentTrackUris && trackIndex !== null && trackIndex >= 0 
    ? currentTrackUris[trackIndex] 
    : null;
  
  // Use refs to always have current values in event listeners
  const trackIndexRef = useRef(trackIndex);
  const totalTracksRef = useRef(totalTracks);
  const playTrackRef = useRef(playTrack);
  const skippingRef = useRef(false);
  
  useEffect(() => {
    trackIndexRef.current = trackIndex;
    totalTracksRef.current = totalTracks;
    playTrackRef.current = playTrack;
  }, [trackIndex, totalTracks, playTrack]);

  console.log('SpotifyEmbed render:', { 
    currentPlayingId, 
    currentUri, 
    trackIndex, 
    hasController: !!controllerRef.current,
    isMounted 
  });

  // Load positions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('spotify-positions');
      if (saved) {
        const savedPositions = JSON.parse(saved);
        setPositions(savedPositions);
        console.log('Loaded positions from localStorage:', savedPositions);
      }
    } catch (error) {
      console.error('Error loading positions from localStorage:', error);
    }
  }, [setPositions]);

  // Save positions to localStorage
  const savePositionsToStorage = (positions: Record<string, number>) => {
    try {
      localStorage.setItem('spotify-positions', JSON.stringify(positions));
      console.log('Saved positions to localStorage');
    } catch (error) {
      console.error('Error saving positions to localStorage:', error);
    }
  };

  // Only render on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load Spotify Iframe API script
  useEffect(() => {
    if (!isMounted) return;
    
    const existingScript = document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    
    if (existingScript) {
      if (window.Spotify) {
        console.log('Using existing Spotify API');
        setIFrameAPI(window.Spotify);
      }
      return;
    }

    console.log('Loading Spotify IFrame API script');
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    document.body.appendChild(script);
  }, [isMounted]);

  // Wait for API to be ready
  useEffect(() => {
    if (!isMounted || iFrameAPI) return;

    window.onSpotifyIframeApiReady = (SpotifyIframeApi: any) => {
      console.log('Spotify IFrame API Ready callback');
      setIFrameAPI(SpotifyIframeApi);
    };
  }, [iFrameAPI, isMounted]);

  // Create/update controller
  useEffect(() => {
    if (!isMounted || !iFrameAPI || !embedRef.current || !currentUri) {
      console.log('Skipping controller creation:', { 
        isMounted, 
        hasAPI: !!iFrameAPI, 
        hasRef: !!embedRef.current, 
        currentUri 
      });
      return;
    }

    // If controller exists, just update the URI
    if (controllerRef.current) {
      console.log('Updating existing controller with URI:', currentUri);
      controllerRef.current.loadUri(currentUri);
      return;
    }

    // Create new controller
    console.log('Creating new controller with URI:', currentUri);

    const options: any = {
      width: "100%",
      height: "152",
      uri: currentUri,
    };

    if (accessToken) {
      options.getOAuthToken = (callback: (token: string) => void) => {
        callback(accessToken);
      };
    }

    iFrameAPI.createController(
      embedRef.current,
      options,
      (newController: any) => {
        console.log('Controller created successfully');
        controllerRef.current = newController;
        
        newController.addListener("ready", () => {
          console.log('Player ready');
          setController(newController);
        });

        newController.addListener("playback_update", (e: any) => {
          const { isPaused, position, duration, playingURI } = e.data;
          setPaused(isPaused);

          // Check if track has ended (within 1 second of duration) to autoplay the next track
          if (
            duration &&
            position &&
            !isPaused &&
            duration - position < 1000 &&
            !skippingRef.current
          ) {
            skippingRef.current = true; // move this line above async work
          
            const currentIndex = trackIndexRef.current;
            const currentTotal = totalTracksRef.current;
          
            if (currentIndex < currentTotal - 1) {
              console.log("Auto-playing next track:", currentIndex + 1);
              setTimeout(() => {
                playTrackRef.current(currentIndex + 1);
                // reset after a delay to allow controller to update
                setTimeout(() => {
                  skippingRef.current = false;
                }, 2000);
              }, 500);
            } else {
              console.log("Reached end of playlist");
            }
          }
          

          // Seeking to the position of the track
          if (position > 30000) {
            // Only save positions for episodes after 30 seconds
            if (playingURI && playingURI.includes("episode")) {
              // Reset position to 0 if the track is ending
              const newPosition = duration && position && duration - position < 1000 ? 0 : position;
              
              setPositions(prevPositions => {
                const newPositions = {
                  ...prevPositions,
                  [playingURI]: newPosition,
                };
                // Save to localStorage
                savePositionsToStorage(newPositions);
                return newPositions;
              });
            }
          } else if (positionsRef.current[playingURI]) {
            const ms = positionsRef.current[playingURI];
            const seconds = ms / 1000;
            console.log("Seeking to", ms, "ms (", seconds, "seconds )");
            controllerRef.current.seek(seconds);
            
            setPositions(prevPositions => {
              const { [playingURI]: _, ...rest } = prevPositions;
              // Save updated positions to localStorage
              savePositionsToStorage(rest);
              return rest;
            });
          }
        });

        newController.addListener("error", (e: any) => {
          console.error('Embed player error:', e);
        });
      }
    );
  }, [iFrameAPI, setController, setPaused, currentUri, isMounted, accessToken]);

  const convertUriToEmbedUrl = (spotifyUri: string) => {
    if (spotifyUri.startsWith("spotify:")) {
      const parts = spotifyUri.split(":");
      return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
    }
    if (spotifyUri.includes("open.spotify.com")) {
      return spotifyUri.replace("open.spotify.com/", "open.spotify.com/embed/");
    }
    return "";
  };

  // Always render the container once mounted
  if (!isMounted) {
    return null;
  }

  // Show placeholder when no track is selected
  if (!currentPlayingId || !currentUri) {
    return null;
  }

  return (
    <div className="w-full mx-auto relative">
      <div 
        ref={embedRef} 
        className="rounded-xl overflow-hidden min-h-[152px]"
      />
    </div>
  );
}