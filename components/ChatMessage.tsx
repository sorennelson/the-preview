"use client";

import { useState, useEffect } from "react";
import { CirclePlay, Pause, Play } from 'lucide-react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner } from "@/components/ui/spinner";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import { useSpotifyPlayer } from "@/contexts/SpotifyPlayerContext";
import { Message, MessageType } from "@/types/Message";
import React from "react";


interface ChatMessageProps {
  message: Message;
  messageId: string; // Unique ID for this message
}

export function ChatMessage({message, messageId}: ChatMessageProps) {
  const { playTracks, trackIndex, paused, currentPlayingId } = useSpotifyPlayer();
  const [imageBlobUrls, setImageBlobUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [markdownImageBlobs, setMarkdownImageBlobs] = useState<Record<string, string>>({});
  const [playingIndex, setPlayingIndex] = useState(-1);

  let messageText = message.text;

  if (message.messageType === MessageType.LLM) {
    if (message.text.startsWith("```markdown")) {
      messageText = message.text.substring("```markdown".length).trimStart();
    }
    if (messageText.endsWith("```")) {
      messageText = messageText.substring(0, messageText.length - 3).trimEnd();
    }
  }

  useEffect(() => {
    setPlayingIndex(trackIndex ?? -1);
  }, [trackIndex])

  // Load images with ngrok-skip-browser-warning header
  useEffect(() => {
    const loadImages = async () => {
      if (!message.images || message.images.length === 0) return;
      
      setImagesLoading(true);
      
      const blobUrls = await Promise.all(
        message.images.map(async (imageUrl) => {
          try {
            const response = await fetch(imageUrl, {
              headers: {
                'ngrok-skip-browser-warning': 'true'
              }
            });
            const blob = await response.blob();
            return URL.createObjectURL(blob);
          } catch (error) {
            console.error('Failed to load image:', error);
            return '';
          }
        })
      );
      
      setImageBlobUrls(blobUrls.filter(url => url !== ''));
      setImagesLoading(false);
    };

    loadImages();

    // Cleanup blob URLs when component unmounts
    return () => {
      imageBlobUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [message.images]);

  // Load markdown images with ngrok-skip-browser-warning header
  useEffect(() => {
    const loadMarkdownImages = async () => {
      // Extract image URLs from markdown text
      const imageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g;
      const matches = [...messageText.matchAll(imageRegex)];
      
      if (matches.length === 0) return;

      const blobMap: Record<string, string> = {};
      
      await Promise.all(
        matches.map(async (match) => {
          const imageUrl = match[1];
          try {
            const response = await fetch(imageUrl, {
              headers: {
                'ngrok-skip-browser-warning': 'true'
              }
            });
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            blobMap[imageUrl] = blobUrl;
          } catch (error) {
            console.error('Failed to load markdown image:', error);
          }
        })
      );
      
      setMarkdownImageBlobs(blobMap);
    };

    if (message.messageType === MessageType.LLM) {
      loadMarkdownImages();
    }

    // Cleanup blob URLs when component unmounts
    return () => {
      Object.values(markdownImageBlobs).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [messageText, message.messageType]);

  function extractSpotifyUris(text: string): string[] {
    const trackRegex = /https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/g;
    const trackUrls = text.match(trackRegex) || [];
    const trackUris = trackUrls.map(url => "spotify:track:" + url.split("/track/")[1].split("?")[0]);
    
    const podRegex = /https:\/\/open\.spotify\.com\/episode\/[a-zA-Z0-9]+/g;
    const podUrls = text.match(podRegex) || [];
    const podUris = podUrls.map(url => "spotify:episode:" + url.split("/episode/")[1].split("?")[0]);

    return [...trackUris, ...podUris];
  }
  const trackUris = extractSpotifyUris(messageText);

  function listContainsSpotifyUrls(props: any): boolean {
    const trackRegex = /https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/g;
    const artistRegex = /https:\/\/open\.spotify\.com\/artist\/[a-zA-Z0-9]+/g;
    const albumRegex = /https:\/\/open\.spotify\.com\/album\/[a-zA-Z0-9]+/g;
    const podRegex = /https:\/\/open\.spotify\.com\/episode\/[a-zA-Z0-9]+/g;
    const showRegex = /https:\/\/open\.spotify\.com\/show\/[a-zA-Z0-9]+/g;

    for (const item in props.children) {
      const href = props.children?.[item]?.props?.children?.props?.href;
      if (href && (trackRegex.test(href) || artistRegex.test(href) || albumRegex.test(href) || podRegex.test(href) || showRegex.test(href))) {
        return true;
      }

    }

    return false;
  }

  return (
    <>
      {/* User message */}
      {message.messageType === MessageType.User && (
        <Card className="pt-4 pb-4">
          <CardContent className="pl-4 flex gap-2">
            <div>
              <CirclePlay className="h-5 w-5" />
            </div>
            <Label className="whitespace-pre-line leading-relaxed select-text">{messageText}</Label>
          </CardContent>
        </Card>
      )}

      {message.messageType === MessageType.LLM && (
        <div className="pl-6 flex gap-2 pr-6">
          <div className="w-full">

            {/* Loading state for images */}
            {imagesLoading && message.images && message.images.length > 0 && (
              <div className="mb-4 flex justify-center items-center">
                <Spinner />
              </div>
            )}

            {/* Image with tracks */}
            {trackUris.length > 0 && (
              <Card className="py-4 px-0 mb-4">
                {imageBlobUrls.length > 0 ? (
                  <>
                    <div className="mb-0 grid grid-cols-1 gap-4 px-4">
                      {imageBlobUrls.map((blobUrl, idx) => (
                        <div key={idx} className="relative overflow-hidden flex justify-center items-center">
                          <img 
                            src={blobUrl}
                            alt={`Generated image ${idx + 1}`}
                            className="w-full h-auto object-cover max-w-xs rounded-lg"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                    <CardFooter className="!pt-4 border-t border-gray-200/05 justify-center">
                      {/* Loading state for images with tracks */}
                      {imagesLoading && message.images && message.images.length > 0 && (
                        <div className="mb-2 flex justify-center items-center">
                          <Spinner />
                        </div>
                      )}
                      {/* Player */}
                      <SpotifyPlayer trackUris={trackUris} playlistId={messageId} />
                    </CardFooter>
                  </>
                ) : (
                  <div className="justify-center">
                      {/* Loading state for images with tracks */}
                      {imagesLoading && message.images && message.images.length > 0 && (
                        <div className="mb-2 flex justify-center items-center">
                          <Spinner />
                        </div>
                      )}
                      {/* Player */}
                      <SpotifyPlayer trackUris={trackUris} playlistId={messageId} />
                  </div>
                )}
              </Card>
            )}

            {/* LLM message markdown */}
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#6b7280" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#374151")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
                  />
                ),

                img: ({ node, src, ...props }) => {
                  const imageSrc =
                    typeof src === "string" && markdownImageBlobs[src]
                      ? markdownImageBlobs[src]
                      : src;
                  return (
                    <div className="flex justify-center items-center my-4">
                      <img
                        {...props}
                        src={imageSrc}
                        className="w-full h-auto object-cover max-w-xs rounded-lg"
                        loading="lazy"
                      />
                    </div>
                  );
                },

                h1: ({ node, ...props }) => (
                  <h1
                    style={{ fontSize: "2rem", fontWeight: "bold", margin: "1rem 0" }}
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <h2
                    style={{ fontSize: "1.5rem", fontWeight: "600", margin: "0.75rem 0" }}
                    {...props}
                  />
                ),
                h3: ({ node, ...props }) => (
                  <h3
                    style={{ fontSize: "1.25rem", fontWeight: "600", margin: "0.5rem" }}
                    {...props}
                  />
                ),

                ul: ({ node, ...props }) =>
                  listContainsSpotifyUrls(props) ? (
                    <Card className="mt-4 mb-4 pt-0 pb-0">
                      <CardContent className="pl-0 pr-0 flex ml-0 mr-0 w-full">
                        <ul
                          className="w-full"
                          style={{ listStyleType: "none", marginRight: "0" }}
                          {...(props as any)}
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <ul
                      style={{
                        listStyleType: "disc",
                        marginLeft: "1.5rem",
                        marginTop: "0.5rem",
                      }}
                      {...(props as any)}
                    />
                  ),

                ol: ({ node, ...props }) =>
                  listContainsSpotifyUrls(props) ? (
                    <Card className="mt-4 mb-4 pt-0 pb-0">
                      <CardContent className="pl-0 pr-0 flex ml-0 mr-0 w-full">
                        <ol
                          className="w-full"
                          style={{ listStyleType: "none", marginRight: "0" }}
                          {...(props as any)}
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <ol
                      style={{
                        listStyleType: "decimal",
                        marginLeft: "1.5rem",
                        marginTop: "0.5rem",
                      }}
                      {...(props as any)}
                    />
                  ),

                li: (rawProps: any) => {
                  const href = React.Children.toArray(rawProps.children)
                    .map((child) =>
                      typeof child === "string"
                        ? child
                        : (child as any)?.props?.href ?? ""
                    )
                    .join(" ")
                    .trim();
                
                  const isSpotifyItem = href !== null && href !== undefined;
                
                  const extractSpotifyUri = (url: string): string | null => {
                    const trackMatch = url.match(/https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
                    if (trackMatch) return `spotify:track:${trackMatch[1]}`;
                    
                    const episodeMatch = url.match(/https:\/\/open\.spotify\.com\/episode\/([a-zA-Z0-9]+)/);
                    if (episodeMatch) return `spotify:episode:${episodeMatch[1]}`;
                    
                    return null;
                  };

                  // Extract the uri and index of the uri
                  let uri: string | null = null;
                  let currentIndex: number = -1;
                  if (isSpotifyItem) {
                    uri = extractSpotifyUri(href);
                    if (uri) {
                      currentIndex = trackUris.findIndex((trackUri) => trackUri === uri);
                    }
                  }

                  const handleTrackClick = () => {
                    if (!isSpotifyItem || !uri || currentIndex === -1) return;

                    playTracks(trackUris, currentIndex);
                    setPlayingIndex(currentIndex);
                  };
                
                  return isSpotifyItem ? (
                    <li
                      className="hover:bg-slate-800 flex gap-4 items-center"
                      style={{
                        paddingTop: "1rem",
                        paddingBottom: "1rem",
                        paddingLeft: "1.5rem",
                        paddingRight: "1rem",
                        borderBottom: "0.1px solid rgba(107, 114, 128, 0.25)",
                      }}
                      onClick={handleTrackClick}
                      {...rawProps}
                    >
                      {currentIndex !== playingIndex || currentIndex === -1 || paused || messageId !== currentPlayingId  ? (
                        <Play
                          className="flex-shrink-0 h-4 w-4"
                          style={{ color: "#6b7280" }}
                        />
                      ) : (
                        <Pause
                          className="flex-shrink-0 h-4 w-4"
                          style={{ color: "#6b7280" }}
                        />
                      )}
                      <span className="flex-1">{rawProps.children}</span>
                    </li>
                  ) : (
                    <li
                      style={{ paddingLeft: "0.5rem", marginBottom: "0.5rem" }}
                      {...rawProps}
                    />
                  );
                },

                em: ({ node, ...props }) => (
                  <em style={{ fontStyle: "italic" }} {...props} />
                ),
              }}
            >
              {messageText}
            </Markdown>

          </div>
        </div>
      )}
    </>
  );
}
