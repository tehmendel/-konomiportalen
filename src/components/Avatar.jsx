export default function Avatar({ src, name, size = '' }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className={`avatar ${size}`}>
      {src ? <img src={src} alt={name || ''} /> : initials}
    </div>
  )
}
