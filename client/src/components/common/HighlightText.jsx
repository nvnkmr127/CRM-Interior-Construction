import React from 'react';

export default function HighlightText({ text, highlight }) {
  if (!highlight || !highlight.trim()) {
    return <span>{text}</span>;
  }

  // Convert to string safely in case of numbers (like amounts)
  const safeText = String(text || '');
  if (!safeText) return null;

  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = safeText.split(regex);

  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} style={{ backgroundColor: '#fef08a', color: '#1e293b', padding: '0 2px', borderRadius: '2px' }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
