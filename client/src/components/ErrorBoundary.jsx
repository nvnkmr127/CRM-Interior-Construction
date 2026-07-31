import { Component } from 'react'
import ErrorFallback from './ErrorFallback'

class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null, isReloading: false }

  static getDerivedStateFromError(error) {
    if (
      error?.message?.includes('Failed to fetch dynamically imported module') || 
      error?.message?.includes('Importing a module script failed')
    ) {
      return { hasError: true, error, isReloading: true }
    }
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    if (this.state.isReloading) {
      const reloadKey = 'chunk_failed_reloading';
      const isReloading = sessionStorage.getItem(reloadKey);
      if (!isReloading) {
        sessionStorage.setItem(reloadKey, 'true');
        window.location.reload();
        return;
      } else {
        sessionStorage.removeItem(reloadKey); // clear it and show error if it fails again
        this.setState({ isReloading: false }); // Show standard fallback
      }
    }

    console.error('ErrorBoundary caught:', error, errorInfo)
    // In production: Sentry.captureException(error, { extra: errorInfo })
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isReloading: false })
  }

  render() {
    if (this.state.isReloading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">Updating application...</p>
          </div>
        </div>
      );
    }
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}

export default ErrorBoundary
