import { type SVGProps } from 'react'

/** 3D cube — thinking mode일 때 보라/시안 그라데이션 stroke */
export function CubeIcon({ gradient = false, ...props }: SVGProps<SVGSVGElement> & { gradient?: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={gradient ? 'url(#vd-cube-gradient)' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      {...props}
    >
      <defs>
        <linearGradient id="vd-cube-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff80ff" />
          <stop offset="100%" stopColor="#80ffff" />
        </linearGradient>
      </defs>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

/** Brain — thinking mode 그라데이션 표시용 */
export function BrainIcon({ gradient = false, ...props }: SVGProps<SVGSVGElement> & { gradient?: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={gradient ? 'url(#vd-brain-gradient)' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      {...props}
    >
      <defs>
        <linearGradient id="vd-brain-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff80ff" />
          <stop offset="100%" stopColor="#80ffff" />
        </linearGradient>
      </defs>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04Z"/>
    </svg>
  )
}
