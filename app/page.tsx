"use client";

import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { ArrowUp } from 'lucide-react';
import { FormEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { signIn, useSession } from "next-auth/react";
import TextShuffle from "@/components/TextShuffle";
import { Progress } from "@/components/ui/progress";
import { ChatMessage } from "@/components/ChatMessage";
import { Message, MessageType } from "@/types/Message";

const FAST_APP = process.env.NEXT_PUBLIC_FAST_APP;

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
    text: "Make me a playlist for my trip to NYC. I like podcasts like The Rewatchables.",
    date: new Date(),
  },
  {
    messageType: MessageType.User,
    text: "Make a playlist for my next workout. Use my favorite artists for inspiration.",
    date: new Date(),
  },
  {
    messageType: MessageType.User,
    text: "Create a playlist for the top movie at the box office.",
    date: new Date(),
  },
];

export default function Home() {
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<string>("");
  const [enableStreaming, setEnableStreaming] = useState(true);
  // const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = useSession();

  // Load session ID from Spotify account and history on mount
  useEffect(() => {
    if (session?.accessToken) {
      setAccessToken(session?.accessToken);
    }
    if (session?.user?.id) {
      const spotifyUserId = session.user.id;
      setSessionId(spotifyUserId);
      loadHistory(spotifyUserId);
    }
  }, [session]);

  // // Auto-scroll to bottom when new messages arrive
  // useEffect(() => {
  //   // Use a small timeout to ensure DOM has updated
  //   setTimeout(() => {
  //     messagesEndRef.current?.scrollIntoView({ 
  //       behavior: 'auto', // Use 'auto' instead of 'smooth' for iOS
  //       block: 'end' 
  //     });
  //   }, 100);
  // }, [chat]);

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
        // Don't clear session for authenticated users
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
      console.log(`loadedMessages`, loadedMessages);
      setChat(loadedMessages);
    } catch (err) {
      console.error('Failed to load history:', err);
      // Keep session ID for authenticated users
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
          spotify_user_token: accessToken,
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
              // Session ID is already set from Spotify authentication
              console.log('Connected with session:', data.session_id);
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
      
      // Session ID is already set from Spotify authentication
      console.log('Response for session:', data.session_id);

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
    <div className="font-sans grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-4 sm:p-8 md:p-12 ">
      <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-screen-xl sm:max-w-2xl sm:px-4 mb-16">
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
            {streamingStatus === "Thinking" && (
              <div className="w-full flex justify-center items-center gap-2">
                <Spinner />
                <p className="text-sm text-muted-foreground animate-pulse">{streamingStatus}</p>
              </div>
            )}
            {streamingStatus && streamingStatus !== "Thinking" && (
              <>
                <div className="flex justify-center w-full">
                  <p className="text-sm text-muted-foreground animate-pulse">
                    {streamingStatus} - This may take a few minutes
                  </p>
                </div>
                <Progress
                  value={
                    (getPlaylistState[streamingStatus] * 100) /
                    Object.keys(getPlaylistState).length
                  }
                />
              </>
            )}
          </>
        )}

        {chat.length === 0 && !loading && (
          <div className="grid grid-cols-2 gap-4 w-full sm:px-8">
            {defaultMessages.map((message, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="border border-gray-300 p-4 rounded-lg w-full whitespace-pre-line transition-all h-full flex items-center justify-center"
                onClick={() => handleSubmitExample(message)}
              >
                {message.text}
              </Button>
            ))}
          </div>
        )}

        {/* <div ref={messagesEndRef} /> */}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
        <div className="mx-auto w-full max-w-screen-xl sm:max-w-2xl px-4">
          <form
            className="flex justify-between w-full items-center gap-4 py-4"
            onSubmit={handleSubmit}
          >
            <Textarea
              className="flex-1 min-h-[40px] resize-none"
              placeholder="Request a playlist..."
              rows={1}
              disabled={loading}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button type="submit" variant="outline" className="bg-background" disabled={loading}>
              <ArrowUp />
            </Button>
          </form>
        </div>
      </footer>
    </div>

  );
}