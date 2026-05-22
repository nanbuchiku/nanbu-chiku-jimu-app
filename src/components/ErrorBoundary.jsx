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
        <div role="alert" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F0F2F5", flexDirection:"column", gap:16, padding:24 }}>
          <div style={{ fontSize:40 }}>⚠️</div>
          <div style={{ color:"#B71C1C", fontSize:15, fontWeight:700 }}>予期しないエラーが発生しました</div>
          <div style={{ color:"#78909C", fontSize:12, maxWidth:400, textAlign:"center" }}>{this.state.error.message}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ background:"#1A3A6B", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:14, cursor:"pointer", fontWeight:600 }} onClick={() => window.location.reload()}>再読み込み</button>
            <button style={{ background:"#ECEFF1", color:"#546E7A", border:"none", borderRadius:8, padding:"10px 24px", fontSize:14, cursor:"pointer", fontWeight:600 }} onClick={() => this.setState({ error: null, errorInfo: null })}>閉じて続ける</button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ maxWidth:600, fontSize:10, color:"#90A4AE", background:"#fff", padding:12, borderRadius:6, cursor:"pointer" }}>
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
