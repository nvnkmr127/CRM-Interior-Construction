import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({
  variant = 'text', // 'text', 'circle', 'rect'
  width,
  height,
  className = '',
  ...props
}) {
  const skeletonClassName = [
    styles.skeleton,
    styles[variant],
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={skeletonClassName}
      style={{ width, height }}
      {...props}
    />
  );
}
