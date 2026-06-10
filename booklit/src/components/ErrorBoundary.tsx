import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

// Prevents a single runtime error from leaving only the gradient on screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Booklit crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg p-8">
          <div className="max-w-lg text-center">
            <h1 className="font-display text-3xl font-bold mb-3">Something broke</h1>
            <p className="text-text-dim text-sm mb-4">
              The app hit an error while rendering. Try reloading. If it keeps happening,
              the backend may not be running.
            </p>
            <pre className="text-left text-[11px] text-text-muted bg-bg-surface rounded-lg p-3 overflow-auto max-h-48">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-accent text-bg text-sm font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
