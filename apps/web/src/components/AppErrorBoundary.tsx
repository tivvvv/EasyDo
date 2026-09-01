import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EasyDo 界面渲染失败.', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <span>
          <AlertTriangle size={24} />
        </span>
        <p>EasyDo 遇到了界面错误</p>
        <h1>你的本地数据仍然安全</h1>
        <small>{this.state.error.message}</small>
        <button onClick={() => window.location.reload()} type="button">
          <RotateCcw size={16} />
          重新载入
        </button>
      </main>
    );
  }
}
