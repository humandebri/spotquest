import { useEffect } from 'react'

function TestApp() {
  useEffect(() => {
    console.log('TestApp mounted')
  }, [])

  return (
    <div style={{ backgroundColor: 'blue', color: 'white', padding: '20px' }}>
      <h1>Test App is working!</h1>
      <p>If you can see this, the app is rendering correctly.</p>
    </div>
  )
}

export default TestApp