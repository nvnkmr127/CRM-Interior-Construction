import styles from './Spinner.module.css'

export default function Spinner({ size='md', color='var(--color-accent)', className='' }) {
  return (
    <div 
      className={`${styles.spinner} ${styles[size]} ${className}`} 
      style={{ color }} 
    />
  )
}
