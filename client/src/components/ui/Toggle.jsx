import styles from './Toggle.module.css'

export default function Toggle({ checked, onChange, disabled, size = 'md' }) {
  return (
    <label className={`${styles.switch} ${styles[size]} ${disabled ? styles.disabled : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={`${styles.slider} ${styles.round}`}></span>
    </label>
  )
}
