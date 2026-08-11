import type { ReactNode } from 'react'
import { useInView } from '../hooks/useInView'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
}

export default function Reveal({ children, className = '', delay = 0 }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
