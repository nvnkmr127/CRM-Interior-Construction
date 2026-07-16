
export default function ErrorFallback({ error, onReset }) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-50 p-4 rounded-full mb-6">
        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      {import.meta.env.DEV && error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-6 max-w-md break-words border border-red-200">
          {error.message || 'Unknown error'}
        </p>
      )}
      <div className="flex gap-4">
        <button 
          onClick={onReset}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
