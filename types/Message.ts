export interface Message {
  messageType: MessageType;
  text: string;
  date: Date;
  images?: string[];  // Array of image URLs
  mode?: string;
  id?: string;  // Add unique ID for tracking
  userToken?: string | null;
}

export enum MessageType {
  User = "user",
  LLM = "llm"
}