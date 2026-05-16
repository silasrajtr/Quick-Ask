"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MessageRenderer({ content, isStreaming }: MessageRendererProps) {
  return (
    <div className={`prose-chat ${isStreaming ? "streaming-cursor" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}