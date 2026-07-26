import { io } from 'socket.io-client';

const SOCKET_URL = 'https://192.168.1.157:4000';

// Disable TLS verification for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('Logging in via REST to get token...');
try {
  const loginRes = await fetch(`${SOCKET_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'itzspike14@gmail.com', password: 'Aether' }),
  });
  
  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login successful. Token obtained:', token.substring(0, 20) + '...');
  
  console.log('\nTesting Socket.io connection with valid token...');
  const socket = io(SOCKET_URL, {
    auth: { token },
    rejectUnauthorized: false,
  });

  socket.on('connect', () => {
    console.log('Socket connected successfully! ID:', socket.id);
    socket.disconnect();
    process.exit(0);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    console.log('Socket connection timed out.');
    process.exit(1);
  }, 5000);

} catch (err) {
  console.error('Error during test:', err.message);
  process.exit(1);
}
