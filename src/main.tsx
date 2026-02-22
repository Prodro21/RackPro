import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { AppErrorBoundary } from './App'
import { router } from './router'
import { UpdatePrompt } from './components/UpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AppErrorBoundary>
  </StrictMode>,
)
