import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function ThreadLens({
  selectedText,
  lensKey,
  conversationHistory,
  lensMessages,
  onMessagesUpdate,
  onClose,
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lensMessages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    const updated = [...lensMessages, userMsg];
    onMessagesUpdate(lensKey, updated);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are a focused assistant helping the user deeply explore this highlighted text: "${selectedText}". Use markdown formatting — bullet points, bold, headers where helpful. Be concise and insightful.`,
            },
            ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
            ...lensMessages.slice(1),
            userMsg,
          ],
        }),
      });

      const data = await res.json();
      const reply =
        data.choices?.[0]?.message?.content ??
        data.error?.message ??
        'Unknown error';

      onMessagesUpdate(lensKey, [...updated, { role: 'assistant', content: reply }]);
    } catch (err) {
      onMessagesUpdate(lensKey, [
        ...updated,
        { role: 'assistant', content: 'Network error: ' + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lens-overlay" onClick={onClose}>
      <div className="lens-panel" onClick={(e) => e.stopPropagation()}>
        <div className="lens-header">
          <div className="lens-header-left">
            <span className="lens-icon">🔍</span>
            <div className="lens-quote">"{selectedText}"</div>
          </div>
          <button className="lens-close" onClick={onClose}>✕</button>
        </div>
        <div className="lens-messages">
          {lensMessages.map((m, i) => (
            <div key={i} className={`lens-bubble ${m.role}`}>
              {m.role === 'assistant' ? (
                <div className="md-content">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          ))}
          {loading && (
            <div className="lens-bubble assistant loading">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="lens-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask about this…"
            autoFocus
          />
          <button onClick={send} disabled={loading}>↑</button>
        </div>
      </div>
    </div>
  );
}