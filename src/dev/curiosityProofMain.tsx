import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CuriosityProofPage from './CuriosityProofPage';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CuriosityProofPage />
  </StrictMode>,
);
