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
        <span className="material-icons">
          {isOpen ? 'close' : 'smart_toy'}
        </span>
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
