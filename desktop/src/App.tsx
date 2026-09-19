import { brandCssVars } from '@suhuella/brand'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { OnboardingWindow } from './windows/OnboardingWindow'
import { SettingsWindow } from './windows/SettingsWindow'
import { SuggestionWindow } from './windows/SuggestionWindow'

type Route = '/settings' | '/suggestion' | '/onboarding'

function currentRoute(): Route {
  const hash = window.location.hash.replace('#', '')
  if (hash === '/suggestion') return '/suggestion'
  if (hash === '/onboarding') return '/onboarding'
  return '/settings'
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const shell = (content: ReactNode) => (
    <div
      className="flex h-dvh min-h-0 w-full flex-col overflow-hidden"
      style={brandCssVars() as CSSProperties}
    >
      {content}
    </div>
  )

  if (route === '/suggestion') {
    return shell(<SuggestionWindow />)
  }

  if (route === '/onboarding') {
    return shell(<OnboardingWindow />)
  }

  return shell(<SettingsWindow />)
}
