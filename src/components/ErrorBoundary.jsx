import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-700">
            <h1 className="text-3xl font-bold text-red-500 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Something went wrong
            </h1>
            <p className="text-gray-300 mb-6 text-lg">
              The application encountered an unexpected error.
            </p>
            
            <div className="bg-black/50 p-4 rounded-lg overflow-auto max-h-64 mb-6 border border-gray-700 font-mono text-sm text-red-300">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.058T8 11m0 0h6m-6 0a2 2 0 100 4 2 2 0 000-4zm0 0V3m0 20v-5h.058T8 13m0 0h6m-6 0a2 2 0 100 4 2 2 0 000-4zm0 0v5" />
              </svg>
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
