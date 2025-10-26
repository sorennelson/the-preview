"use client";

import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { ArrowUp, CirclePlay } from 'lucide-react';
import { FormEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner } from "@/components/ui/spinner";
import { signIn, useSession } from "next-auth/react";
import TextShuffle from "@/components/TextShuffle";
import SpotifyPlayer from "@/components/SpotifyPlayer";
import { Progress } from "@/components/ui/progress";

const FAST_APP = process.env.NEXT_PUBLIC_FAST_APP;

enum MessageType {
  User = "user",
  LLM = "llm"
}

interface Message {
  messageType: MessageType;
  text: string;
  date: Date;
  images?: string[];  // Array of image URLs
  mode?: string;
  id?: string;  // Add unique ID for tracking
}

const getPlaylistState: Record<string, number> = {
  "Creating your playlist": 1,
  "Searching the web": 2,
  "Searching Spotify": 3,
  "Generating an image": 4,
  "Finalizing results": 5
};


const defaultMessages: Message[] = [
  {
    messageType: MessageType.User,
    text: "Create a playlist for Dune pt 2.",
    date: new Date(),
  },
  {
    messageType: MessageType.User,
    text: "Make me a playlist for my trip to NYC. I like Jay-Z and podcasts like The Rewatchables.",
    date: new Date(),
  },
  {
    messageType: MessageType.User,
    text: "What are the top movies this week?",
    date: new Date(),
  },
  {
    messageType: MessageType.User,
    text: "Create a playlist for the top movies this week.",
    date: new Date(),
  },
];

interface ChatMessageProps {
  message: Message;
  messageId: string; // Unique ID for this message
}


function ChatMessage({message, messageId}: ChatMessageProps) {
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
            <Label className="whitespace-pre-line leading-relaxed">{messageText}</Label>
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
              <Card className="p-4 mb-4">
                {imageBlobUrls.length > 0 && (
                  <div className="mb-0 grid grid-cols-1 gap-4">
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
                
                {/* Loading state for images with tracks */}
                {imagesLoading && message.images && message.images.length > 0 && (
                  <div className="mb-2 flex justify-center items-center">
                    <Spinner />
                  </div>
                )}
                
                {/* Player */}
                <SpotifyPlayer trackUris={trackUris} playlistId={messageId} />
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
                  return message.mode === "playlist" && listContainsSpotifyUrls(props) ? (
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
                  return message.mode === "playlist" && listContainsSpotifyUrls(props) ? (
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

export default function Home() {
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<string>("");
  const [playlistState, setPlaylistState] = useState<number | null>(null);
  const [enableStreaming, setEnableStreaming] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession()

  // Load session ID and history on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('chat_session_id');
    if (savedSessionId) {
      setSessionId(savedSessionId);
      loadHistory(savedSessionId);
    }
  }, []);

  // Save session ID to localStorage when it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chat_session_id', sessionId);
    }
  }, [sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const loadHistory = async (sid: string) => {
    try {
      console.log('Loading history for session:', sid);
      const response = await fetch(`${FAST_APP}/api/history/${sid}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        }
      });
      
      if (!response.ok) {
        console.error('Response not OK:', response.status);
        localStorage.removeItem('chat_session_id');
        setSessionId(null);
        return;
      }
  
      const data = await response.json();
      
      // Check if messages array is empty
      if (!data.messages || data.messages.length === 0) {
        console.log('No messages in history, starting fresh');
        // Don't clear session - it exists but is just empty
        return;
      }
  
      const loadedMessages: Message[] = data.messages.map((msg: any, index: number) => ({
        messageType: msg.role === 'user' ? MessageType.User : MessageType.LLM,
        text: msg.content,
        date: new Date(msg.timestamp),
        images: msg.images || undefined,
        mode: msg.mode || undefined, 
        id: `${msg.role}-${msg.timestamp}-${index}`
      }));
      setChat(loadedMessages);
    } catch (err) {
      console.error('Failed to load history:', err);
      localStorage.removeItem('chat_session_id');
      setSessionId(null);
    }
  };

  async function makeAgentRequest(agentText: string) {
    // If streaming is disabled, use regular request
    if (!enableStreaming) {
      return makeRegularRequest(agentText);
    }

    // Use streaming request
    try {
      const response = await fetch(`${FAST_APP}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          message: agentText,
          session_id: sessionId,
          mode: 'auto',
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let finalData = null;
      let mode = "playlist";

      while (true) {
        const { done, value } = await reader.read();
        console.log("---");
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            console.log(data);
            
            if (data.type === 'connected') {
              if (!sessionId) {
                setSessionId(data.session_id);
              }
            } else if (data.type === 'mode') {
              mode = data.mode;
              setStreamingStatus(`${data.mode === "playlist" ? "Creating your playlist" : "Thinking"}`);
            } else if (data.type === 'task_start') {
              setStreamingStatus(data.task);
            } else if (data.type === 'task_complete') {
              setStreamingStatus(`${data.message}`);
            } else if (data.type === 'step') {
              setStreamingStatus(`${data.message}`);
            } else if (data.type === 'complete') {
              finalData = data;
              setStreamingStatus("");
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
      finalData.mode = mode;
      return finalData;

    } catch (error) {
      console.error('Error:', error);
      setStreamingStatus("");
      return null;
    }
  }

  async function makeRegularRequest(agentText: string) {
    try {
      const response = await fetch(`${FAST_APP}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          message: agentText,
          session_id: sessionId,
          mode: 'auto',
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Update session ID if this is a new session
      if (!sessionId) {
        setSessionId(data.session_id);
      }

      return data;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  }

  // handle clicking an example message to submit it as if the user typed it
  async function handleSubmitExample(example: Message) {
    // Add user message to chat
    setChat(prevChat => [
      ...prevChat,
      {
        ...example,
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    ]);

    setLoading(true);
    const data = await makeAgentRequest(example.text);
    setLoading(false);

    if (data && data.response) {
      // Add agent response to chat
      setChat(prevChat => [
        ...prevChat,
        {
          messageType: MessageType.LLM,
          text: data.response,
          date: new Date(),
          images: data.images || undefined,
          mode: data.mode || undefined
        }
      ]);
    } else {
      // Remove the user message if request failed
      setChat(prevChat => prevChat.slice(0, -1));
    }
  }


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    const form = event.currentTarget;
    const textarea = form.querySelector("textarea");
    
    if (!textarea || !textarea.value.trim()) {
      return;
    }

    const userMessage = textarea.value;
    
    // Add user message to chat
    setChat(prevChat => [
      ...prevChat, 
      {
        messageType: MessageType.User, 
        text: userMessage, 
        date: new Date(),
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      },
    ]);

    // Reset textarea
    textarea.value = "";
    textarea.style.height = 'auto';

    setLoading(true);
    const data = await makeAgentRequest(userMessage);
    console.log(`data`);
    console.log(data);
    setLoading(false);

    if (data && data.response) {
      // Add agent response to chat
      setChat(prevChat => [
        ...prevChat, 
        {
          messageType: MessageType.LLM,
          text: data.response, 
          date: new Date(),
          images: data.images || undefined,
          mode: data.mode || undefined,
          id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      ]);
    } else {
      // Remove the user message if request failed
      setChat(prevChat => prevChat.slice(0, -1));
      // Restore the user's message in the textarea
      textarea.value = userMessage;
    }
  }


  if (!session) {
    return (
      <div className="font-sans grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-4 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center justify-center xl:max-w-2/5 md:max-w-2/3 w-full overflow-y-auto">
          <div className="text-center text-gray-500 mt-8 w-full">
            <p className="text-lg mb-2">The Preview</p>
            <TextShuffle />
          </div>

          <div className="flex justify-center w-full">
            <Button 
              type="button"
              variant="secondary"
              onClick={() => signIn("spotify")}
            >
              Sign in with Spotify
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="font-sans grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-4 sm:p-20">
      
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start xl:max-w-2/5 md:max-w-2/3 w-full overflow-y-auto">
        {chat.length === 0 && !loading && (
          <div className="text-center text-gray-500 mt-8 w-full">
            <p className="text-lg mb-2">The Preview</p>
            <TextShuffle />
          </div>
        )}
        
        <ul className="w-full">
          {chat.map((message, idx) => {
            const messageId = message.id || `message-${idx}`;
            return (
              <li key={messageId} className={idx < chat.length - 1 ? "mb-6" : "mb-0"}>
                <ChatMessage message={message} messageId={messageId} />
              </li>
            );
          })}
        </ul>

        
        {loading && (
          <>
            {streamingStatus && streamingStatus === "Thinking" && (
              <div className="w-full flex justify-center">
                <Spinner />
                <div className="flex items-center gap-2 pl-2">
                  <p className="text-sm text-muted-foreground animate-pulse m-0">
                    {streamingStatus}
                  </p>
                </div>
              </div>
            )}
            {streamingStatus && streamingStatus !== "Thinking" && (
              <>
                <div className="flex justify-center w-full">
                  <p className="text-sm text-muted-foreground animate-pulse m-0 ">
                    {streamingStatus} - This may take a few minutes
                  </p>
                </div>
                <Progress value={getPlaylistState[streamingStatus]*100/Object.keys(getPlaylistState).length} />
              </>
            )}
          </>
        )}
        
        {chat.length === 0 && !loading && (
          <div className="grid grid-cols-2 grid-rows-2 gap-4 mb-4 w-full auto-rows-fr">
            {defaultMessages.map((message, idx) => (
              <Button
                key={idx}
                variant="outline"
                className={`border border-gray-300 p-4 rounded-lg w-full whitespace-pre-line transition-all h-full flex items-center justify-center`}
                type="button"
                onClick={() => {
                  handleSubmitExample(message);
                }}
              >
                {message.text}
              </Button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />

      </main>

      <footer className="row-start-3 w-full px-4 md:px-0 xl:max-w-2/5 md:max-w-2/3 mx-auto p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky bottom-0 shadow-lg">

        <form className="flex justify-between w-full items-center gap-4" onSubmit={handleSubmit}>
          <Textarea 
            className="flex-1 min-h-[40px] resize-none" 
            placeholder="Type your message or request a playlist..." 
            rows={1}
            disabled={loading}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button 
            type="submit" 
            variant="outline"
            className="bg-background"
            disabled={loading}
          >
            <ArrowUp />
          </Button>
        </form>
      </footer>
    </div>
  );
}