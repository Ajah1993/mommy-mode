import React from 'react';
import ReactDOM from 'react-dom/client';
import BloomApp from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BloomApp />
  </React.StrictMode>
);

// Register service worker for offline PWA support
serviceWorkerRegistration.register({
  onSuccess: () => console.log('bloom. is ready for offline use!'),
  onUpdate: () => console.log('bloom. has a new version available.'),
});
