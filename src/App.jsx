import React from 'react';
import Layout from './components/Layout';

function App() {
  // Version check for debugging deployment issues
  console.log('DEPLOYMENT CHECK: Image Path Fix v3 (Hardcoded CDN)');
  
  return (
    <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden">
      <Layout />
    </div>
  );
}

export default App;
