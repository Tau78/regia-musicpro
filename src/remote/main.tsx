import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RemoteApp } from './RemoteApp'
import './remote.css'

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <StrictMode>
      <RemoteApp />
    </StrictMode>,
  )
}
