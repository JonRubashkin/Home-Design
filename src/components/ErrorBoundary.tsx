import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// App-wide safety net. A render crash anywhere below this boundary (e.g. the
// "New design" infinite-update loop that used to white-screen the whole app, or
// any future render error) is caught here and shown as a readable message
// instead of an unmounted, blank page. We do NOT auto-retry into the same render
// — if the failure is a render loop, re-rendering immediately would just loop
// again — so recovery is an explicit user action (reload).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep a single console record for debugging; the boundary stops the loop,
    // so this fires once rather than flooding the console.
    console.error("EZ Design Homes crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="crash-screen" role="alert" data-testid="error-boundary">
          <div className="crash-card">
            <h1>Something went wrong</h1>
            <p>
              The editor hit an unexpected error and stopped to avoid a blank
              screen. Your saved designs are stored in this browser and are not
              affected.
            </p>
            <p className="crash-detail">{this.state.error.message}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
