import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AboutView } from './views/AboutView'
import './styles.css'

const about = new URLSearchParams(window.location.search).get('about') === '1'
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      {about ? <AboutView /> : <App />}
    </StrictMode>
  )
}
