# Thread Lens 🔍

> **In-context doubt clearance for AI conversations.**
> Select any text in an AI reply, ask a focused question about it in a popup — without losing your place in the main chat.

---

## The Problem

When reading a long AI response, you often hit a line you don't understand. The only option today is to scroll to the bottom, type a follow-up question, get a reply, then **scroll all the way back up** to find where you left off. In a long conversation this happens repeatedly and breaks your reading flow completely.

## The Solution — Thread Lens

Thread Lens lets you **select any text** in an AI reply and instantly open a focused sub-conversation about just that text — in a half-screen popup. When you're done, close it and you're **exactly where you left off**. No scrolling. No context lost.

The highlight stays on the text permanently so you can reopen that sub-conversation anytime to review or continue it.

---

## Features

- **Thread Lens popup** — select any text in an AI reply → half-screen focused sub-chat opens instantly
- **Persistent highlights** — explored text stays purple-underlined after closing the lens
- **Reopenable conversations** — click any highlight to restore that exact sub-conversation
- **ChatGPT-style UI** — clean dark theme chat interface
- **Chat history sidebar** — grouped by Today / Yesterday / Last 7 days / Older
- **Auto-titles** — each chat is named from your first message automatically
- **Rename & delete chats** — full chat management
- **Search** — search across all chats by title and message content
- **Markdown rendering** — bullet points, bold, code blocks, headers all supported
- **Copy button** — copy any AI message with one click
- **Regenerate** — regenerate the last AI response
- **Mobile responsive** — sidebar slides over content on small screens
- **Persistent storage** — all chats and lens conversations saved to localStorage

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React + Vite |
| AI Model | Groq — llama-3.3-70b-versatile (free tier) |
| Markdown | react-markdown |
| Styling | Custom CSS |
| Storage | localStorage |
| Hosting | Vercel |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/thread-lens.git
cd thread-lens
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your Groq API key

Create a `.env` file in the root:

```
VITE_GROQ_API_KEY=your_groq_api_key_here
```

Get a free API key at [console.groq.com](https://console.groq.com)

### 4. Run locally

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## How Thread Lens Works

```
User reads AI reply
        ↓
Selects any text they don't understand
        ↓
"Ask with Thread Lens" tooltip appears
        ↓
Half-screen popup opens with selected text as context
        ↓
User asks focused questions in the popup
        ↓
Closes popup → returns to exact position in main chat
        ↓
Highlight stays on text permanently (purple underline + dot)
        ↓
User can reopen that highlight anytime to continue the sub-conversation
```

---

## File Structure

```
thread-lens/
├── index.html
├── vite.config.js
├── package.json
├── .env                  ← VITE_GROQ_API_KEY=your_key
└── src/
    ├── main.jsx          ← React entry point
    ├── App.jsx           ← Main chat UI + Thread Lens logic
    ├── ThreadLens.jsx    ← Lens popup component
    └── style.css         ← All styling
```

---

## Why This Matters

This feature addresses a real UX gap in every AI chat product today — including ChatGPT, Claude, and Gemini. None of them allow in-context clarification without disrupting the main conversation flow.

Thread Lens is a prototype demonstrating what this could look like as a native feature.

---

## Author

Built by **[M.Mohamed Arshad]**
Connect on [LinkedIn](www.linkedin.com/in/mohamedarshad-m)

---

## License

MIT — free to use, modify and distribute.
