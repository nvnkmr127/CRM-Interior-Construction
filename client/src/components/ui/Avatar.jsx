import styles from './Avatar.module.css'

const COLOURS = ['#E8935A','#2D6A4F','#1A3A5C','#8B2020','#4A2040','#5C3A00','#1A5C3A']
const getColour = (name='?') => COLOURS[name.charCodeAt(0) % COLOURS.length]

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
}

export default function Avatar({ name, imageUrl, size='md', className='' }) {
  if (imageUrl) {
    return (
      <div className={`${styles.avatar} ${styles[size]} ${className}`}>
        <img className={styles.img} src={imageUrl} alt={name || 'Avatar'} />
      </div>
    )
  }
  
  return (
    <div 
      className={`${styles.avatar} ${styles[size]} ${className}`}
      style={{ background: getColour(name), color: 'white' }}
    >
      {getInitials(name)}
    </div>
  )
}
