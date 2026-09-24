import styles from './Avatar.module.css'

const COLOURS = ['#E8935A','#2D6A4F','#1A3A5C','#8B2020','#4A2040','#5C3A00','#1A5C3A']
const getColour = (name) => {
  const safeName = (typeof name === 'string' && name.trim()) ? name.trim() : '?'
  return COLOURS[safeName.charCodeAt(0) % COLOURS.length]
}

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function Avatar({ name, imageUrl, src, url, size = 'md', className = '', style = {}, ...rest }) {
  const image = imageUrl || src || url

  if (image) {
    return (
      <div className={`${styles.avatar} ${styles[size] || styles.md} ${className}`} style={style} {...rest}>
        <img className={styles.img} src={image} alt={name || 'Avatar'} />
      </div>
    )
  }
  
  return (
    <div 
      className={`${styles.avatar} ${styles[size] || styles.md} ${className}`}
      style={{ background: getColour(name), color: 'white', ...style }}
      {...rest}
    >
      {getInitials(name)}
    </div>
  )
}
