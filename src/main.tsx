import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { applyTheme, getTheme } from './theme';
import './index.css';

applyTheme(getTheme());

createRoot(document.getElementById('root')!).render(<App />);
