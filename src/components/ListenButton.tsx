import { useRef, useState } from 'react'

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
      <path
        d="M16 8.5a4 4 0 0 1 0 7M18.7 6a7 7 0 0 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

/** Loudspeaker button that streams the article read aloud (Norwegian, via Piper). */
export function ListenButton({ articleId }: { articleId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [state, setState] = useState<State>('idle')

  function onClick() {
    const a = audioRef.current
    if (!a) return
    if (state === 'playing') {
      a.pause()
      return
    }
    if (state === 'idle' || state === 'error') {
      // (Re)start from the top. Cache-buster lets a failed attempt retry cleanly.
      a.src = `/api/tts?id=${encodeURIComponent(articleId)}&t=${state === 'error' ? Date.now() : 0}`
      setState('loading')
      a.play().catch(() => setState('error'))
      return
    }
    // paused -> resume
    a.play().catch(() => setState('error'))
  }

  const label =
    state === 'error'
      ? 'Kunne ikke spille av'
      : state === 'playing'
        ? 'Spiller av …'
        : state === 'loading'
          ? 'Laster lyd …'
          : state === 'paused'
            ? 'Fortsett'
            : 'Hør saken'

  return (
    <div className="tts">
      <button
        type="button"
        className={`tts-btn tts-btn--${state}`}
        onClick={onClick}
        aria-label={state === 'playing' ? 'Pause opplesning' : 'Hør saken lest opp'}
        aria-pressed={state === 'playing'}
      >
        {state === 'loading' ? (
          <span className="spinner spinner--dark" aria-hidden="true" />
        ) : state === 'playing' ? (
          <PauseIcon />
        ) : (
          <SpeakerIcon />
        )}
      </button>
      <span className="tts-label">{label}</span>
      <audio
        ref={audioRef}
        onPlaying={() => setState('playing')}
        onWaiting={() => setState('loading')}
        onPause={() => setState((s) => (s === 'playing' ? 'paused' : s))}
        onEnded={() => setState('idle')}
        onError={() => setState('error')}
      />
    </div>
  )
}
