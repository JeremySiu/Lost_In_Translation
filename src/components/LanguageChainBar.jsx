'use client'

const FLAG_MAP = {
  Mandarin: '🇨🇳', Swahili: '🇰🇪', Finnish: '🇫🇮', Icelandic: '🇮🇸',
  Mongolian: '🇲🇳', Yoruba: '🇳🇬', Georgian: '🇬🇪', Basque: '🇪🇸',
  Tamil: '🇮🇳', Quechua: '🇵🇪', Latvian: '🇱🇻', Zulu: '🇿🇦',
  Kazakh: '🇰🇿', Welsh: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', Amharic: '🇪🇹',
}

function LangPill({ lang }) {
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '999px',
      border: '1px solid rgba(155, 109, 255, 0.3)',
      background: 'rgba(155, 109, 255, 0.08)',
      color: 'var(--accent-purple)',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '12px',
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      {FLAG_MAP[lang] ?? ''} {lang}
    </span>
  )
}

export default function LanguageChainBar({ chain }) {
  if (!chain?.length) return null

  const items = ['EN', ...chain, 'EN']

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '6px',
      justifyContent: 'center',
      padding: '12px 0',
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {item === 'EN' ? (
            <span style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>EN</span>
          ) : (
            <LangPill lang={item} />
          )}
          {i < items.length - 1 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
          )}
        </span>
      ))}
    </div>
  )
}
