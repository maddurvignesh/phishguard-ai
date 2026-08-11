import { useEffect, useRef, useState } from 'react'

interface Options {
  threshold?: number
  once?: boolean
  rootMargin?: string
}

export function useInView<T extends HTMLElement>(options: Options = {}) {
  const { threshold = 0.15, once = true, rootMargin = '0px 0px -10% 0px' } = options
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) obs.unobserve(entry.target)
          } else if (!once) {
            setInView(false)
          }
        })
      },
      { threshold, rootMargin },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold, once, rootMargin])

  return { ref, inView }
}
