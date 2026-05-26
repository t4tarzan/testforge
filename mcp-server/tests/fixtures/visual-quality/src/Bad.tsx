// FIXTURE — heavy inline styles + hardcoded px + inline color literals.
// Comment line below intentionally mentions style={ and 16px as a regex
// trap that AST-based detection must NOT count.
// style= 16px 24px #ff0000  ← all of these are inside a comment, not real attrs
export function Card() {
  return (
    <div style={{ width: '320px', height: '480px', padding: '16px', color: '#ff6b6b', background: '#0a0a0a' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '8px', color: '#ffffff' }}>Title</h2>
      <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#a0a0a0' }}>Body</p>
      <button style={{ padding: '12px 16px', background: '#1976d2', color: '#fff' }}>OK</button>
    </div>
  );
}

export function CardTwo() {
  return (
    <div style={{ width: '400px', padding: '20px' }}>
      <span style={{ color: '#abc' }}>Hex 3-digit color</span>
    </div>
  );
}

export function CardThree() {
  return (
    <header style={{ height: '64px', borderBottom: '1px solid #eee' }}>Nav</header>
  );
}
