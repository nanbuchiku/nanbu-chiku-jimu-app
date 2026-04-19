import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const style = document.createElement('style');
style.textContent = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Hiragino Kaku Gothic ProN','Meiryo',sans-serif; background: #F0F2F5; color: #263238; }
.hover-row:hover { background: #F5F7FA !important; }
select, input, textarea { outline: none; font-family: inherit; }
select:focus, input:focus, textarea:focus { border-color: #1A3A6B !important; box-shadow: 0 0 0 2px rgba(26,58,107,.1); }
@media print {
  header, nav, .no-print { display: none !important; }
  #print-doc { box-shadow: none !important; border: none !important; }
  body { background: white !important; }
}
@media (max-width: 600px) {
  main { padding: 10px 10px !important; }
}
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
