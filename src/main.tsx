import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-v2.js', { updateViaCache: 'none' })
      .then(reg => {
        console.log('Service Worker registrado com sucesso:', reg);
        // Força uma busca imediata por atualizações do SW
        reg.update();
      })
      .catch(err => console.warn('Erro ao registrar Service Worker:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
