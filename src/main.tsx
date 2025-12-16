import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { ResetPasswordPage } from './components/features/ResetPasswordPage';
import { ProfilePageWrapper } from './components/features/ProfilePageWrapper';
import { LandingPage } from './components/features/LandingPage';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/profile" element={<ProfilePageWrapper />} />
        <Route path="/app/*" element={<App />} />
        <Route path="/home" element={<App />} />
        <Route path="/config" element={<App />} />
        <Route path="/reports/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
