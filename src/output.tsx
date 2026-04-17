import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './output.css'
import OutputApp from './OutputApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OutputApp />
  </StrictMode>,
)
