import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import * as serviceWorker from './utils/serviceWorker'
import { setupDevelopmentAuth, mockGeolocation } from './setupDev'

// 開発環境でmockAuthを自動的に有効にする
setupDevelopmentAuth()

// 開発環境で位置情報をモック（必要に応じてコメントアウト）
if (localStorage.getItem('mockGeo') === 'true') {
  mockGeolocation()
}

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Register service worker for PWA functionality
serviceWorker.register()