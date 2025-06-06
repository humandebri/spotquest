// Simple debug server to test if Node.js is working
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <h1>Debug Server Working!</h1>
    <p>Port 3000 is available</p>
    <p>Time: ${new Date().toISOString()}</p>
  `);
});

server.listen(3000, () => {
  console.log('Debug server running on http://localhost:3000');
});