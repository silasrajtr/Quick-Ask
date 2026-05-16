# Quick-Ask

A smarter chat interface that lets you resolve doubts **inline** — without derailing your conversation.

While chatting, if you come across a term or phrase you don't understand, simply select it with your mouse. A small **💡 Clear Doubt** button will appear. Click it, and a focused mini chat popup opens right next to the selected text — already knowing the context of your main conversation. Once your doubt is cleared, close the popup and continue exactly where you left off.

To understand the full idea and mechanism behind this project, visit this tutorial:
[https://code2tutorial.com/tutorial/9b4b6b49-a9ec-4694-bb4d-0197c20a64cd/index.md](https://code2tutorial.com/tutorial/9b4b6b49-a9ec-4694-bb4d-0197c20a64cd/index.md)

---

## Getting Started

Follow these steps in order. Take it slow — it's simpler than it looks.

### 1. Clone the repository

Open a terminal (or Command Prompt on Windows) and run:

```bash
git clone https://github.com/silasrajtr/Quick-Ask.git
cd Quick-Ask
```

---

### 2. Get a Groq API key

This project uses [Groq](https://groq.com) to power the AI responses. It's free to sign up.

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Go to **API Keys** in the left sidebar
4. Click **Create API Key**, give it any name, and copy the key

---

### 3. Create the `.env.local` file

In the root of the project folder (same place as `package.json`), create a new file called `.env.local` and paste this inside:

```bash
GROQ_API_KEY=your_key_here
```

Replace `your_key_here` with the key you copied from Groq. Save the file.

> This file is gitignored — it will never be pushed to GitHub. Your key stays private.

---

### 4. Install dependencies

Run this in your terminal inside the project folder:

```bash
npm install
```

---

### 5. Run the project

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to use it

1. Start a conversation in the main chat — ask about anything
2. When the AI replies, **select any word or phrase** you don't understand by clicking and dragging
3. A **💡 Clear Doubt** button will appear above the selection — click it
4. A mini chat popup opens right next to the selected text
5. It already knows the context of your main conversation — just ask your doubt
6. Close the popup when done and continue the main conversation
7. The resolved text stays **highlighted in amber** — click it anytime to reopen that doubt

---

## Tech Stack

- [Next.js](https://nextjs.org) — framework
- [Groq](https://groq.com) — AI inference (fast streaming)
- [Tailwind CSS](https://tailwindcss.com) — styling
- [next-themes](https://github.com/pacocoursey/next-themes) — dark/light mode
- [react-markdown](https://github.com/remarkjs/react-markdown) — markdown rendering
