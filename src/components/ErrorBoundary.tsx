import { Component, type ErrorInfo, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch(error: Error, info: ErrorInfo) { if (import.meta.env.DEV) console.error('CivicSync render error', error, info.componentStack); }
  render() { return this.state.failed ? <main className="fatal-error"><h1>This page could not be displayed.</h1><p>Reload the app to retry. Unsaved form changes may need to be re-entered.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload CivicSync</button></main> : this.props.children; }
}
