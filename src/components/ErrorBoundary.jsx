import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F0F2F5", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:40 }}>⚠️</div>
          <div style={{ color:"#B71C1C", fontSize:15, fontWeight:700 }}>予期しないエラーが発生しました</div>
          <div style={{ color:"#78909C", fontSize:12, maxWidth:400, textAlign:"center" }}>{this.state.error.message}</div>
          <button style={{ background:"#1A3A6B", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:14, cursor:"pointer", fontWeight:600 }} onClick={() => window.location.reload()}>再読み込み</button>
        </div>
      );
    }
    return this.props.children;
  }
}
