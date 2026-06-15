import React from 'react';

export default function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return null;
  }

  let styles = {};

  if (score <= 30) {
    styles = {
      backgroundColor: 'var(--color-danger-bg, #fee2e2)',
      color: 'var(--color-danger, #b91c1c)',
      border: '1px solid var(--color-danger-border, #fca5a5)'
    };
  } else if (score <= 60) {
    styles = {
      backgroundColor: 'var(--color-warning-bg, #fef3c7)',
      color: 'var(--color-warning, #b45309)',
      border: '1px solid var(--color-warning-border, #fcd34d)'
    };
  } else {
    styles = {
      backgroundColor: 'var(--color-success-bg, #d1fae5)',
      color: 'var(--color-success, #047857)',
      border: '1px solid var(--color-success-border, #6ee7b7)'
    };
  }

  return (
    <div 
      className="h-6 min-w-[32px] px-2 text-xs font-bold rounded-full flex items-center justify-center shadow-sm"
      style={styles}
      title={`Lead Score: ${score}`}
    >
      {score}
    </div>
  );
}
