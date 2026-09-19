import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installBrowserHost } from './host/install-browser-host'
import './index.css'

if (typeof window !== 'undefined' && !window.suhuella) {
  installBrowserHost()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
