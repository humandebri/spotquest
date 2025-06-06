import { useEffect, useState } from 'react'

function DebugApp() {
  const [status, setStatus] = useState<string[]>(['App started'])

  useEffect(() => {
    setStatus(prev => [...prev, 'useEffect ran'])
    
    // Check if styles are loading
    const styles = document.styleSheets
    setStatus(prev => [...prev, `StyleSheets loaded: ${styles.length}`])
    
    // Check for errors
    window.addEventListener('error', (e) => {
      setStatus(prev => [...prev, `Error: ${e.message}`])
    })
  }, [])

  return (
    <div style={{
      backgroundColor: '#f0f0f0',
      color: '#333',
      padding: '20px',
      fontFamily: 'monospace',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Debug Information</h1>
      <ul>
        {status.map((s, i) => (
          <li key={i} style={{ marginBottom: '5px' }}>{s}</li>
        ))}
      </ul>
      <div style={{ marginTop: '20px' }}>
        <p>Window location: {window.location.href}</p>
        <p>Document ready state: {document.readyState}</p>
      </div>
    </div>
  )
}

export default DebugApp