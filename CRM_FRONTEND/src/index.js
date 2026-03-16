import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppThemeProvider } from './context/AppThemeProvider';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppThemeProvider>
        <App />
      </AppThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
