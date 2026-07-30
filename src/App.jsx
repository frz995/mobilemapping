import React from 'react';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import useAuth from './hooks/useAuth';

function App() {
  const { user, loading } = useAuth();

  // Show blank screen while checking auth session
  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Show the map if authenticated
  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden">
        <Layout />
      </div>
    </ErrorBoundary>
  );
}

export default App;
