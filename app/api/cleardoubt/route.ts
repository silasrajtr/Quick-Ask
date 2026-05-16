import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const { messages, selectedText, conversationContext } = await req.json();

  const systemPrompt = `You are a focused, concise assistant helping clarify a specific term or phrase mid-conversation.

THE USER IS CURRENTLY IN A CONVERSATION ABOUT:
${conversationContext}

THE USER SELECTED THIS SPECIFIC TEXT TO ASK ABOUT:
"${selectedText}"

YOUR RULES:
- Answer ONLY about the selected text or term. Do not drift into other topics.
- Be concise. This is a quick clarification, not a deep dive.
- Relate your answer back to the conversation context when relevant.
  For example: if they are talking about phones and ask about RAM, explain RAM in the context of phones.
- Use Markdown formatting — bold key terms, use bullet points for lists, code blocks for technical syntax.
- Stop when the concept is clear. Do not keep expanding after the doubt is resolved.
- If the user asks a follow-up still about the selected term, answer it.
  If they go completely off-topic, gently note they may want to continue in the main chat.`;

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    max_tokens: 512,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          controller.enqueue(encoder.encode(delta));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}