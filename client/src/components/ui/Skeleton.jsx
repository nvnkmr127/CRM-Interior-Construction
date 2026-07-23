import styles from './Skeleton.module.css';

export default function Skeleton({ width, height, borderRadius = '4px', className = '' }) {
  return (
    <div 
      className={`${styles.skeleton} ${className}`} 
      style={{ width, height, borderRadius }} 
    />
  );
}
