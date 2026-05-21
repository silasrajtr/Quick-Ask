"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, MessageCircleQuestion, GripHorizontal } from "lucide-react";
import { MessageRenderer } from "./MessageRenderer";
import type { Message, DoubtSession } from "@/lib/types";

interface ClearDoubtPopupProps {
  session: DoubtSession;
  conversationContext: string;
  onClose: () => void;
  onSessionUpdate: (updatedSession: DoubtSession) => void;
}

const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 420;
const MARGIN = 12;

function getInitialPosition(session: DoubtSession) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x = session.anchorX + MARGIN;
  let y = session.anchorY;

  if (x + POPUP_WIDTH > vw - MARGIN) x = session.anchorX - POPUP_WIDTH - MARGIN;
  if (y + POPUP_HEIGHT > vh - MARGIN) y = vh - POPUP_HEIGHT - MARGIN;

  x = Math.max(MARGIN, x);
  y = Math.max(MARGIN, y);

  return { x, y };
}

export function ClearDoubtPopup({
  session,
  conversationContext,
  onClose,
  onSessionUpdate,
}: ClearDoubtPopupProps) {
  const [input, setInput] = useState(
    session.messages.length === 0
      ? `What is "${session.selectedText}"?`
      : ""
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  // Position state — actual rendered position
  const [pos, setPos] = useState(() => getInitialPosition(session));

  // Drag state stored in refs to avoid re-renders during drag
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Target position that the mouse is pulling toward (lerp target)
  const targetPos = useRef(pos);

  // Animation frame ref
  const rafRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages, streamingContent]);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      const len = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  }, []);

  // Lerp animation loop — runs while dragging
  const startLerpLoop = useCallback(() => {
    const LERP_FACTOR = 0.1; // lower = more lag, higher = snappier (0.1 feels weighted)

    const tick = () => {
      setPos((current) => {
        const dx = targetPos.current.x - current.x;
        const dy = targetPos.current.y - current.y;

        // Stop animating when close enough
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          return targetPos.current;
        }

        return {
          x: current.x + dx * LERP_FACTOR,
          y: current.y + dy * LERP_FACTOR,
        };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLerpLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
      startLerpLoop();
    },
    [pos, startLerpLoop]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const rawX = e.clientX - dragOffset.current.x;
      const rawY = e.clientY - dragOffset.current.y;

      // Clamp inside viewport
      targetPos.current = {
        x: Math.max(MARGIN, Math.min(rawX, vw - POPUP_WIDTH - MARGIN)),
        y: Math.max(MARGIN, Math.min(rawY, vh - POPUP_HEIGHT - MARGIN)),
      };
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      // Let lerp finish settling, then stop the loop
      setTimeout(() => stopLerpLoop(), 400);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      stopLerpLoop();
    };
  }, [stopLerpLoop]);

  const sendToApi = useCallback(
    async (messages: Message[]) => {
      setIsStreaming(true);
      setStreamingContent("");

      try {
        const res = await fetch("/api/cleardoubt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            selectedText: session.selectedText,
            conversationContext,
          }),
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

        onSessionUpdate({
          ...session,
          messages: [...messages, { role: "assistant", content: fullContent }],
        });
      } catch (err) {
        console.error(err);
        onSessionUpdate({
          ...session,
          messages: [
            ...messages,
            {
              role: "assistant",
              content: "_Error getting response. Try again._",
            },
          ],
        });
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [session, conversationContext, onSessionUpdate]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...session.messages, userMessage];
    onSessionUpdate({ ...session, messages: updatedMessages });
    await sendToApi(updatedMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="fixed z-50 animate-popup-in"
      style={{
        left: pos.x,
        top: pos.y,
        width: POPUP_WIDTH,
        willChange: "transform",
      }}
    >
      <div
        className="flex flex-col rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
        style={{ height: POPUP_HEIGHT }}
      >
        {/* Header — drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 shrink-0 cursor-grab active:cursor-grabbing select-none"
        >
          <MessageCircleQuestion className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Clear Doubt</p>
            <p className="text-xs text-muted-foreground truncate">
              &ldquo;{session.selectedText}&rdquo;
            </p>
          </div>
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {session.messages.length === 0 && !isStreaming && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-muted-foreground text-center">
                Ask your doubt about{" "}
                <span className="font-medium text-foreground">
                  &ldquo;{session.selectedText}&rdquo;
                </span>
              </p>
            </div>
          )}

          {session.messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%]">
                  <MessageRenderer content={msg.content} />
                </div>
              )}
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[95%]">
                {streamingContent ? (
                  <MessageRenderer content={streamingContent} isStreaming />
                ) : (
                  <div className="flex gap-1 px-2 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border bg-muted/30 px-2 py-2 shrink-0">
          <div className="flex items-end gap-1.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your doubt..."
              rows={1}
              className="flex-1 resize-none bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[34px] max-h-[80px]"
              style={{ lineHeight: "1.4" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 pl-0.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}