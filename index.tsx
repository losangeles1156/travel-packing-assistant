import React from 'react';
import ReactDOM from 'react-dom/client';
import './app.css';
import App from './App';
import StorageGate from './components/StorageGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <StorageGate><App /></StorageGate>
  </React.StrictMode>
);