import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { OFFLINE } from './config'

// The app build is a single fixed screen: lock the document so nothing can scroll.
if (OFFLINE) document.documentElement.classList.add('app-mode')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
