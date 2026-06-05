import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F4F5F7", flexDirection:"column", gap:16, padding:24 }}>
          <div style={{ fontSize:"clamp(20px,3vw,28px)" }}>⚠️</div>
          <div style={{ color:"#B71C1C", fontSize:"clamp(13px,1.8vw,16px)", fontWeight:700 }}>予期しないエラーが発生しました</div>
          <div style={{ color:"#78909C", fontSize:"clamp(12px,1.4vw,14px)", maxWidth:400, textAlign:"center" }}>{this.state.error.message}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ background:"#061B44", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:"clamp(13px,1.8vw,16px)", cursor:"pointer", fontWeight:600 }} onClick={() => window.location.reload()}>再読み込み</button>
            <button style={{ background:"#F1F5F9", color:"#667085", border:"none", borderRadius:8, padding:"10px 24px", fontSize:"clamp(13px,1.8vw,16px)", cursor:"pointer", fontWeight:600 }} onClick={() => this.setState({ error: null, errorInfo: null })}>閉じて続ける</button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ maxWidth:600, fontSize:"clamp(12px,1.4vw,14px)", color:"#98A2B3", background:"#fff", padding:12, borderRadius:6, cursor:"pointer" }}>
              <summary>スタックトレース</summary>
              <pre style={{ whiteSpace:"pre-wrap", marginTop:8 }}>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
