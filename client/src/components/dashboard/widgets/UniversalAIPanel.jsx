import React, { useState } from 'react';
import styles from './UniversalAIPanel.module.css';

export function UniversalAIPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi, I am your CRM AI assistant. How can I help you today?' }
  ]);

  const togglePanel = () => setIsOpen(!isOpen);

  const handleSend = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setMessages([...messages, { role: 'user', text: query }]);
    setQuery('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: 'I am looking into that for you. Currently, this is a mock interface.' }]);
    }, 600);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ''}`} 
        onClick={togglePanel}
        aria-label="Toggle AI Panel"
      >
        {isOpen ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect>
            <circle cx="12" cy="5" r="2"></circle>
            <path d="M12 7v4"></path>
            <line x1="8" y1="16" x2="8.01" y2="16"></line>
            <line x1="16" y1="16" x2="16.01" y2="16"></line>
          </svg>
        )}
      </button>

      {/* AI Panel */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <h2>Universal AI Assistant</h2>
          <p>Ask anything about your dashboard or leads</p>
        </div>
        
        <div className={styles.chatArea}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`${styles.message} ${msg.role === 'ai' ? styles.messageAi : styles.messageUser}`}>
              <div className={styles.bubble}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        
        <form className={styles.inputArea} onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="E.g., Show my overdue follow-ups..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={!query.trim()}>
            Send
          </button>
        </form>
      </div>
    </>
  );
}
