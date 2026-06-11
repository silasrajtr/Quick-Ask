"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Send, Bot, User, MessageCircleQuestion, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { MessageRenderer } from "./MessageRenderer";
import { ClearDoubtPopup } from "./ClearDoubtPopup";
import type { Message, DoubtSession, SelectionState } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

function buildConversationContext(messages: Message[]): string {
  if (messages.length === 0) return "No conversation context yet.";
  const recent = messages.slice(-6);
  return recent
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg hover:bg-accent transition-colors"
      title="Toggle theme"
    >
      <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
      <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
    </button>
  );
}

function SelectionButton({
  selection,
  onTrigger,
}: {
  selection: SelectionState;
  onTrigger: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onTrigger();
      }}
      className="fixed z-40 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white text-xs font-medium shadow-lg hover:bg-amber-600 transition-colors"
      style={{
        left: selection.anchorX,
        top: selection.anchorY - 36,
      }}
    >
      <span>💡</span>
      <span>Clear Doubt</span>
    </button>
  );
}

function AssistantMessage({
  content,
  isStreaming,
  doubtSessions,
  onOpenSession,
}: {
  content: string;
  isStreaming?: boolean;
  doubtSessions: DoubtSession[];
  onOpenSession: (session: DoubtSession) => void;
}) {
  const resolvedSessions = doubtSessions.filter(
    (s) => s.messages.some((m) => m.role === "assistant")
  );

  // Always render markdown fully — marks are applied via a wrapper ref after render
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || resolvedSessions.length === 0) return;

    const container = containerRef.current;

    // Walk all text nodes inside the rendered markdown
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";

        for (const session of resolvedSessions) {
          const idx = text.indexOf(session.selectedText);
          if (idx === -1) continue;

          // Split the text node around the matched term
          const before = text.slice(0, idx);
          const match = text.slice(idx, idx + session.selectedText.length);
          const after = text.slice(idx + session.selectedText.length);

          const mark = document.createElement("mark");
          mark.className = "doubt-marked";
          mark.textContent = match;
          mark.title = "Click to reopen doubt";
          mark.addEventListener("click", () => onOpenSession(session));

          const parent = node.parentNode;
          if (!parent) continue;

          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(mark, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);
          break;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Don't walk into already-marked elements
        if ((node as Element).classList.contains("doubt-marked")) return;
        Array.from(node.childNodes).forEach(walk);
      }
    };

    Array.from(container.childNodes).forEach(walk);
  }, [resolvedSessions, onOpenSession]);

  return (
    <div ref={containerRef}>
      <MessageRenderer content={content} isStreaming={isStreaming} />
    </div>
  );
}

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [doubtSessions, setDoubtSessions] = useState<DoubtSession[]>([]);
  const [activeSession, setActiveSession] = useState<DoubtSession | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setTimeout(() => {
          const sel2 = window.getSelection();
          if (!sel2 || sel2.isCollapsed) setSelection(null);
        }, 200);
        return;
      }

      const selectedText = sel.toString().trim();
      if (selectedText.length < 2) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!chatAreaRef.current?.contains(range.commonAncestorContainer)) return;

      setSelection({
        text: selectedText,
        anchorX: rect.left + rect.width / 2,
        anchorY: rect.top + window.scrollY,
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("doubt-marked")) return;
      if (target.closest("[data-doubt-popup]")) return;
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const triggerClearDoubt = useCallback(() => {
    if (!selection) return;

    const existing = doubtSessions.find(
      (s) => s.selectedText === selection.text
    );
    if (existing) {
      setActiveSession(existing);
      setSelection(null);
      return;
    }

    // Create session with NO messages — user will type the first one
    const newSession: DoubtSession = {
      id: uid(),
      selectedText: selection.text,
      anchorX: selection.anchorX,
      anchorY: selection.anchorY,
      messages: [],
    };

    setDoubtSessions((prev) => [...prev, newSession]);
    setActiveSession(newSession);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [selection, doubtSessions]);

  const handleSessionUpdate = useCallback((updated: DoubtSession) => {
    setDoubtSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setActiveSession(updated);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      setMessages([...newMessages, { role: "assistant", content: fullContent }]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "_Error. Please try again._" },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const conversationContext = buildConversationContext(messages);

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">ClearDoubt Chat</h1>
          <p className="text-xs text-muted-foreground">
            Select any text to resolve doubts inline
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Messages */}
      <div
        ref={chatAreaRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-6 select-text"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <MessageCircleQuestion className="w-10 h-10 opacity-30" />
            <div>
              <p className="text-sm font-medium">Start a conversation</p>
              <p className="text-xs mt-1">
                Ask anything. Select text in responses to clear doubts inline.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
              {msg.role === "user" ? (
                <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                  {msg.content}
                </div>
              ) : (
                <AssistantMessage
                  content={msg.content}
                  doubtSessions={doubtSessions.filter((s) =>
                    msg.content.includes(s.selectedText)
                  )}
                  onOpenSession={(s) => setActiveSession(s)}
                />
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming turn */}
        {isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="max-w-[80%]">
              {streamingContent ? (
                <MessageRenderer content={streamingContent} isStreaming />
              ) : (
                <div className="flex gap-1 py-3">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[42px] max-h-[120px]"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 pl-1">
          Enter to send · Shift+Enter for new line · Select text in responses to clear doubts
        </p>
      </div>

      {/* Selection trigger */}
      {selection && !activeSession && (
        <SelectionButton selection={selection} onTrigger={triggerClearDoubt} />
      )}

      {/* Doubt popup */}
      {activeSession && (
        <div data-doubt-popup>
          <ClearDoubtPopup
            session={activeSession}
            conversationContext={conversationContext}
            onClose={() => setActiveSession(null)}
            onSessionUpdate={handleSessionUpdate}
          />
        </div>
      )}
    </div>
  );
}