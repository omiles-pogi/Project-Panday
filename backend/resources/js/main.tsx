import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AdminApp from './admin/AdminApp'

// /admin is the standalone web admin portal; everything else is the regular app.
const isAdminPortal = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminPortal ? <AdminApp /> : <App />}
  </React.StrictMode>,
)
