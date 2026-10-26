import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App.jsx';
import './ui/tokens.css';
import './ui/base.css';
import './ui/app.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><HashRouter><App/></HashRouter></React.StrictMode>);
