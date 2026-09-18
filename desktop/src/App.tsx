import { useEffect, useState } from 'react'
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

  if (route === '/suggestion') {
    return <SuggestionWindow />
  }

  if (route === '/onboarding') {
    return <OnboardingWindow />
  }

  return <SettingsWindow />
}
