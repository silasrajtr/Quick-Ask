export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface DoubtSession {
  id: string;
  selectedText: string;
  messages: Message[];
  anchorX: number;
  anchorY: number;
}

export interface SelectionState {
  text: string;
  anchorX: number;
  anchorY: number;
}