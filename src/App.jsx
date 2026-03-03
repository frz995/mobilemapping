import React from 'react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden">
        <Layout />
      </div>
    </ErrorBoundary>
  );
}

export default App;
