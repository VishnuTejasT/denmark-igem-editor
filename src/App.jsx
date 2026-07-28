import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import EditorPage from './pages/EditorPage'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/editor" element={<EditorPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
