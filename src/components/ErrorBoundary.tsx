import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Result } from "antd";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8F7F4",
          }}
        >
          <Result
            status="error"
            title="Đã xảy ra lỗi"
            subTitle={this.state.error?.message ?? "Lỗi không xác định"}
            extra={
              <Button
                type="primary"
                onClick={() => this.setState({ hasError: false })}
              >
                Thử lại
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
