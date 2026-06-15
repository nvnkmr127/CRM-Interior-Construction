import React from 'react';
import { Badge } from '../ui';

export default function ScoreBadge({ score }) {
  const numScore = Number(score) || 0;
  let variant = 'danger';
  let label = 'Low intent';
  
  if (numScore >= 61) {
    variant = 'success';
    label = 'High intent';
  } else if (numScore >= 31) {
    variant = 'warning';
    label = 'Medium intent';
  }

  return (
    <span title="Score based on: source, phone verified, budget filled">
      <Badge variant={variant} dot size="sm">
        {numScore}
      </Badge>
    </span>
  );
}
