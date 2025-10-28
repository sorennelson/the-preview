"use client";

import { useState, useEffect } from "react";
import { CirclePlay } from 'lucide-react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner } from "@/components/ui/spinner";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import { Message, MessageType } from "@/types/Message";


interface ChatMessageProps {
  message: Message;
  messageId: string; // Unique ID for this message
}

export function ChatMessage({message, messageId}: ChatMessageProps) {
  const [imageBlobUrls, setImageBlobUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [markdownImageBlobs, setMarkdownImageBlobs] = useState<Record<string, string>>({});

  let messageText = message.text;

  if (message.messageType === MessageType.LLM) {
    if (message.text.startsWith("```markdown")) {
      messageText = message.text.substring("```markdown".length).trimStart();
    }
    if (messageText.endsWith("```")) {
      messageText = messageText.substring(0, messageText.length - 3).trimEnd();
    }
  }

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
      if (
        props.children &&
        props.children[item] &&
        props.children[item].props &&
        props.children[item].props.hasOwnProperty('children') &&
        props.children[item].props.children.props.hasOwnProperty("href") &&
          (
            trackRegex.test(props.children[item].props.children.props.href) || 
            artistRegex.test(props.children[item].props.children.props.href) ||
            albumRegex.test(props.children[item].props.children.props.href) ||
            podRegex.test(props.children[item].props.children.props.href) ||
            showRegex.test(props.children[item].props.children.props.href)
          )
      )  
      {
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
        <div className="pl-4 flex gap-2 pr-4">
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
                {imageBlobUrls.length > 0 && (
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
                )}
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
                
                
              </Card>
            )}

            {/* LLM message markdown */}
            <Markdown remarkPlugins={[remarkGfm]} 
              components={{
                a: ({node, ...props}) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#6b7280" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#374151")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
                  />
                ),
                img: ({node, src, ...props}) => {
                  // Use blob URL if available, otherwise use original src
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
                h1: ({node, ...props}) => (
                  <h1 style={{ fontSize: "2rem", fontWeight: "bold", margin: "1rem 0" }} {...props} />
                ),
                h2: ({node, ...props}) => (
                  <h2 style={{ fontSize: "1.5rem", fontWeight: "600", margin: "0.75rem 0" }} {...props} />
                ),
                h3: ({node, ...props}) => (
                  <h3 style={{ fontSize: "1.25rem", fontWeight: "600", margin: "0.5rem" }} {...props} />
                ),
                ul: ({node, ...props}) => {
                  return listContainsSpotifyUrls(props) ? (
                    <Card className="mt-4 mb-4">
                      <CardContent className="pl-4 flex ml-2 mr-2">
                        <ul style={{ listStyleType: "disc", marginLeft: "1.5rem" }} {...props} />
                      </CardContent>
                    </Card>
                  ) : (
                    <ul style={{ listStyleType: "disc", marginLeft: "1.5rem", marginTop: "0.5rem"}} {...props} />
                  );
                },
                ol: ({node, ...props}) => {
                  return listContainsSpotifyUrls(props) ? (
                    <Card className="mt-4 mb-4">
                      <CardContent className="pl-4 flex ml-2 mr-2">
                        <ol style={{ listStyleType: "decimal", marginLeft: "1.5rem"}} {...props} />
                      </CardContent>
                    </Card>
                  ) : (
                    <ol style={{ listStyleType: "decimal", marginLeft: "1.5rem", marginTop:"0.5rem"}} {...props} />
                  );
                },
                li: ({node, ...props}) => (
                  <li style={{ paddingLeft: "0.5rem", marginBottom: "0.5rem" }} {...props} />
                ),
                em: ({node, ...props}) => (
                  <em style={{ fontStyle: "italic" }} {...props} />
                )
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
