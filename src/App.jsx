import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import ThreadLens from './ThreadLens.jsx';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function createNewChat() {
  return {
    id: generateId(),
    title: 'New Chat',
    messages: [
      {
        id: 1,
        role: 'assistant',
        content:
          'Welcome to **Thread Lens**! I can help you explore any topic in depth.\n\nTry selecting any part of my replies to open a focused sub-conversation about it. You can highlight:\n- A single word\n- A phrase\n- An entire sentence',
      },
    ],
    highlights: {},
    lensConversations: {},
    createdAt: Date.now(),
  };
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

async function callGroq(messages) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  const data = await res.json();
  return (
    data.choices?.[0]?.message?.content ??
    data.error?.message ??
    'Unknown error'
  );
}

export default function App() {
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem('tl_chats');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [createNewChat()];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      return localStorage.getItem('tl_active') ?? chats[0]?.id;
    } catch {}
    return chats[0]?.id;
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lensData, setLensData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0];

  useEffect(() => {
    try {
      localStorage.setItem('tl_chats', JSON.stringify(chats));
      localStorage.setItem('tl_active', activeChatId);
    } catch {}
  }, [chats, activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, loading]);

  const updateActiveChat = useCallback(
    (updater) => {
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, ...updater(c) } : c))
      );
    },
    [activeChatId]
  );

  const sendMessage = useCallback(
    async (overrideInput) => {
      const text = overrideInput ?? input;
      if (!text.trim() || loading) return;
      const userMsg = { id: Date.now(), role: 'user', content: text };
      if (!overrideInput) setInput('');
      setLoading(true);

      const isFirst =
        activeChat.messages.filter((m) => m.role === 'user').length === 0;
      const title = isFirst
        ? text.slice(0, 40) + (text.length > 40 ? '…' : '')
        : null;

      updateActiveChat((c) => ({
        ...(title ? { title } : {}),
        messages: [...c.messages, userMsg],
      }));

      try {
        const reply = await callGroq([
          ...activeChat.messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: text },
        ]);
        updateActiveChat((c) => ({
          messages: [
            ...c.messages,
            { id: Date.now() + 1, role: 'assistant', content: reply },
          ],
        }));
      } catch (err) {
        updateActiveChat((c) => ({
          messages: [
            ...c.messages,
            { id: Date.now() + 1, role: 'assistant', content: 'Network error: ' + err.message },
          ],
        }));
      } finally {
        setLoading(false);
      }
    },
    [input, loading, activeChat, updateActiveChat]
  );

  const regenerate = useCallback(async () => {
    if (loading) return;
    const msgs = activeChat.messages;
    const lastAssistantIdx = [...msgs].reverse().findIndex((m) => m.role === 'assistant');
    if (lastAssistantIdx === -1) return;
    const idx = msgs.length - 1 - lastAssistantIdx;
    const withoutLast = msgs.slice(0, idx);
    updateActiveChat(() => ({ messages: withoutLast }));
    setLoading(true);

    try {
      const reply = await callGroq(
        withoutLast.map((m) => ({ role: m.role, content: m.content }))
      );
      updateActiveChat((c) => ({
        messages: [
          ...c.messages,
          { id: Date.now() + 1, role: 'assistant', content: reply },
        ],
      }));
    } catch (err) {
      updateActiveChat((c) => ({
        messages: [
          ...c.messages,
          { id: Date.now() + 1, role: 'assistant', content: 'Network error: ' + err.message },
        ],
      }));
    } finally {
      setLoading(false);
    }
  }, [loading, activeChat, updateActiveChat]);

  const copyMessage = useCallback((id, content) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleTextSelect = useCallback(
    (selectedText, msgId) => {
      if (!selectedText.trim()) return;
      const lensKey = `${msgId}::${selectedText}`;
      updateActiveChat((c) => {
        const highlights = { ...c.highlights };
        const existing = highlights[msgId] ?? [];
        if (!existing.includes(selectedText))
          highlights[msgId] = [...existing, selectedText];
        const lensConversations = { ...c.lensConversations };
        if (!lensConversations[lensKey]) {
          lensConversations[lensKey] = [
            {
              role: 'assistant',
              content: `You're exploring this highlighted text:\n\n"${selectedText}"\n\nAsk me anything about it.`,
            },
          ];
        }
        return { highlights, lensConversations };
      });
      setLensData({ selectedText, msgId, lensKey });
    },
    [updateActiveChat]
  );

  const handleHighlightClick = useCallback((selectedText, msgId) => {
    setLensData({ selectedText, msgId, lensKey: `${msgId}::${selectedText}` });
  }, []);

  const handleLensConversationUpdate = useCallback(
    (lensKey, newMessages) => {
      updateActiveChat((c) => ({
        lensConversations: { ...c.lensConversations, [lensKey]: newMessages },
      }));
    },
    [updateActiveChat]
  );

  const newChat = () => {
    const chat = createNewChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setLensData(null);
    setInput('');
    setSidebarOpen(window.innerWidth > 768);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = createNewChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) setActiveChatId(next[0].id);
      return next;
    });
  };

  const startRename = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditingTitle(chat.title);
  };

  const commitRename = (id) => {
    if (editingTitle.trim()) {
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c))
      );
    }
    setEditingId(null);
  };

  const filteredChats = searchQuery.trim()
    ? chats.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.messages.some((m) =>
            m.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : chats;

  const groupChats = (list) => {
    const now = Date.now();
    const today = [], yesterday = [], week = [], older = [];
    list.forEach((c) => {
      const diff = now - c.createdAt;
      if (diff < 86400000) today.push(c);
      else if (diff < 172800000) yesterday.push(c);
      else if (diff < 604800000) week.push(c);
      else older.push(c);
    });
    return { today, yesterday, week, older };
  };

  const groups = searchQuery.trim()
    ? { Results: filteredChats }
    : groupChats(filteredChats);

  const renderGroup = (label, items) => {
    if (!items || items.length === 0) return null;
    return (
      <div key={label} className="sidebar-group">
        <div className="sidebar-group-label">{label}</div>
        {items.map((chat) => (
          <div
            key={chat.id}
            className={`sidebar-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => {
              setActiveChatId(chat.id);
              setLensData(null);
              if (window.innerWidth <= 768) setSidebarOpen(false);
            }}
          >
            {editingId === chat.id ? (
              <input
                className="rename-input"
                value={editingTitle}
                autoFocus
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => commitRename(chat.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(chat.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="sidebar-item-title">{chat.title}</span>
                <div className="sidebar-item-actions">
                  <button className="icon-btn" title="Rename" onClick={(e) => startRename(chat, e)}>✏️</button>
                  <button className="icon-btn" title="Delete" onClick={(e) => deleteChat(chat.id, e)}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const lastAssistantMsg = [...(activeChat?.messages ?? [])]
    .reverse()
    .find((m) => m.role === 'assistant');

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={newChat}>
            <span>✏️</span> New Chat
          </button>
          <button
            className={`search-toggle ${searchOpen ? 'active' : ''}`}
            onClick={() => setSearchOpen((p) => !p)}
            title="Search chats"
          >
            🔎
          </button>
        </div>

        {searchOpen && (
          <div className="search-bar">
            <input
              autoFocus
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        )}

        <div className="sidebar-chats">
          {searchQuery.trim()
            ? renderGroup('Results', groups.Results)
            : <>
                {renderGroup('Today', groups.today)}
                {renderGroup('Yesterday', groups.yesterday)}
                {renderGroup('Previous 7 days', groups.week)}
                {renderGroup('Older', groups.older)}
              </>
          }
          {filteredChats.length === 0 && (
            <div className="no-results">No chats found</div>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-brand">🔍 Thread Lens</div>
        </div>
      </aside>

      <div className="main-area">
        <header className="app-header">
          <button className="toggle-btn" onClick={() => setSidebarOpen((p) => !p)}>
            ☰
          </button>
          <span className="header-title">{activeChat?.title ?? 'Thread Lens'}</span>
        </header>

        <main className="messages">
          {activeChat?.messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              highlights={activeChat.highlights[msg.id] ?? []}
              onSelect={handleTextSelect}
              onHighlightClick={handleHighlightClick}
              onCopy={copyMessage}
              copiedId={copiedId}
              isLast={idx === activeChat.messages.length - 1}
            />
          ))}
          {loading && (
            <div className="bubble assistant">
              <div className="assistant-avatar">TL</div>
              <div className="assistant-content">
                <div className="loading">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {!loading && lastAssistantMsg && (
          <div className="regen-bar">
            <button className="regen-btn" onClick={regenerate}>
              ↺ Regenerate response
            </button>
          </div>
        )}

        <footer className="input-bar">
          <div className="input-wrap">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Message Thread Lens…"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="send-btn"
            >
              ↑
            </button>
          </div>
          <p className="input-hint">
            Thread Lens can make mistakes. Highlight any text to explore it deeper.
          </p>
        </footer>
      </div>

      {lensData && (
        <ThreadLens
          selectedText={lensData.selectedText}
          lensKey={lensData.lensKey}
          conversationHistory={activeChat.messages}
          lensMessages={activeChat.lensConversations[lensData.lensKey] ?? []}
          onMessagesUpdate={handleLensConversationUpdate}
          onClose={() => setLensData(null)}
        />
      )}
    </div>
  );
}

// Splits a plain text string into an array of plain-text and highlight segments.
function splitIntoSegments(text, highlights) {
  if (!highlights || highlights.length === 0) return [{ type: 'text', value: text }];

  // Sort longest first to avoid partial-match conflicts
  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  let segments = [{ type: 'text', value: text }];

  sorted.forEach((h) => {
    const next = [];
    segments.forEach((seg) => {
      if (seg.type !== 'text') { next.push(seg); return; }
      const idx = seg.value.indexOf(h);
      if (idx === -1) { next.push(seg); return; }
      if (idx > 0) next.push({ type: 'text', value: seg.value.slice(0, idx) });
      next.push({ type: 'highlight', value: h });
      const tail = seg.value.slice(idx + h.length);
      if (tail) next.push({ type: 'text', value: tail });
    });
    segments = next;
  });

  return segments;
}

// Renders a text node (from ReactMarkdown's AST) with inline highlights applied.
function renderTextWithHighlights(text, highlights, onHighlightClick, msgId) {
  const segments = splitIntoSegments(text, highlights);
  return segments.map((seg, i) =>
    seg.type === 'highlight' ? (
      <mark
        key={i}
        className="thread-highlight"
        title="Click to reopen lens"
        onClick={() => onHighlightClick(seg.value, msgId)}
      >
        {seg.value}
      </mark>
    ) : (
      <React.Fragment key={i}>{seg.value}</React.Fragment>
    )
  );
}

// Renders markdown once, injecting highlight marks inline inside text nodes
// via custom ReactMarkdown components — no block-level wrapping, no layout break.
function renderWithHighlights(content, highlights, onHighlightClick, msgId) {
  const hasHighlights = highlights && highlights.length > 0;

  // Custom renderer that intercepts text inside any inline/block element
  // and injects <mark> spans without wrapping the whole segment in a new block.
  const makeComponents = () => ({
    // Override every element that can contain text to process its children
    p: ({ children }) => <p>{processChildren(children)}</p>,
    li: ({ children }) => <li>{processChildren(children)}</li>,
    h1: ({ children }) => <h1>{processChildren(children)}</h1>,
    h2: ({ children }) => <h2>{processChildren(children)}</h2>,
    h3: ({ children }) => <h3>{processChildren(children)}</h3>,
    h4: ({ children }) => <h4>{processChildren(children)}</h4>,
    td: ({ children }) => <td>{processChildren(children)}</td>,
    th: ({ children }) => <th>{processChildren(children)}</th>,
    blockquote: ({ children }) => <blockquote>{processChildren(children)}</blockquote>,
    strong: ({ children }) => <strong>{processChildren(children)}</strong>,
    em: ({ children }) => <em>{processChildren(children)}</em>,
    // Leave code blocks untouched — don't highlight inside code
    code: ({ children, className }) => <code className={className}>{children}</code>,
  });

  // Recursively walk React children; replace plain string nodes with highlighted segments
  function processChildren(children) {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        return renderTextWithHighlights(child, highlights, onHighlightClick, msgId);
      }
      if (React.isValidElement(child) && child.props.children) {
        return React.cloneElement(child, {}, processChildren(child.props.children));
      }
      return child;
    });
  }

  return (
    <ReactMarkdown components={hasHighlights ? makeComponents() : undefined}>
      {content}
    </ReactMarkdown>
  );
}

function MessageBubble({ msg, highlights, onSelect, onHighlightClick, onCopy, copiedId }) {
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 2) return;
    if (msg.role === 'assistant') onSelect(text, msg.id);
    selection.removeAllRanges();
  };

  if (msg.role === 'user') {
    return (
      <div className="bubble user">
        <div className="user-inner">{msg.content}</div>
      </div>
    );
  }

  const isCopied = copiedId === msg.id;

  return (
    <div className="bubble assistant" onMouseUp={handleMouseUp} style={{ userSelect: 'text' }}>
      <div className="assistant-avatar">TL</div>
      <div className="assistant-content">
        <div className="md-content">
          {renderWithHighlights(msg.content, highlights, onHighlightClick, msg.id)}
        </div>
        <div className="msg-actions">
          <button
            className={`msg-action-btn ${isCopied ? 'copied' : ''}`}
            onClick={() => onCopy(msg.id, msg.content)}
            title="Copy"
          >
            {isCopied ? '✓ Copied' : '⎘ Copy'}
          </button>
          <button
            className="msg-action-btn"
            onClick={() => {
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) {
                const text = selection.toString().trim();
                if (text.length > 1) onSelect(text, msg.id);
              }
            }}
            title="Select text to lens it"
          >
            🔍 Lens selection
          </button>
        </div>
      </div>
    </div>
  );
}
