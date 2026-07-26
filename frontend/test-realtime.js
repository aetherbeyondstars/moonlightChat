import { io } from 'socket.io-client';

const SOCKET_URL = 'https://192.168.1.157:4000';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function registerAndLogin(username, email, password) {
  try {
    const res = await fetch(`${SOCKET_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // maybe already registered
  }
  
  // Try logging in
  const res = await fetch(`${SOCKET_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return await res.json();
}

try {
  console.log('Logging in User A (aether)...');
  const userA = await registerAndLogin('aether', 'itzspike14@gmail.com', 'Aether');
  
  console.log('Logging in User B (test_user)...');
  const userB = await registerAndLogin('test_user', 'test_user@example.com', 'Password123');

  // User A creates a server to make sure both can join
  console.log('User A creates a server...');
  const serverRes = await fetch(`${SOCKET_URL}/api/servers`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userA.token}`
    },
    body: JSON.stringify({ name: 'Test Server' }),
  });
  const server = await serverRes.json();
  console.log('Created server:', server.name, 'Invite code:', server.inviteCode);

  // User B joins the server
  console.log('User B joins the server...');
  await fetch(`${SOCKET_URL}/api/servers/join`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userB.token}`
    },
    body: JSON.stringify({ inviteCode: server.inviteCode }),
  });

  // Get the default general channel
  const channelsRes = await fetch(`${SOCKET_URL}/api/channels/server/${server.id}`, {
    headers: { 'Authorization': `Bearer ${userA.token}` },
  });
  const channels = await channelsRes.json();
  const generalChannel = channels.find(c => c.name === 'general');
  console.log('General channel ID:', generalChannel.id);

  // Connect socket for User A
  console.log('Connecting User A socket...');
  const socketA = io(SOCKET_URL, { auth: { token: userA.token }, rejectUnauthorized: false });
  
  // Connect socket for User B
  console.log('Connecting User B socket...');
  const socketB = io(SOCKET_URL, { auth: { token: userB.token }, rejectUnauthorized: false });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const check = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    socketA.on('connect', check);
    socketB.on('connect', check);
  });
  console.log('Both sockets connected!');

  // Both join server and channel rooms
  console.log('Joining channel room...');
  socketA.emit('server:join', { serverId: server.id });
  socketA.emit('channel:join', { channelId: generalChannel.id });
  
  socketB.emit('server:join', { serverId: server.id });
  socketB.emit('channel:join', { channelId: generalChannel.id });

  // Set up receiver listener on User B
  let receivedMessage = null;
  socketB.on('message:new', (msg) => {
    console.log('User B received message in real-time!', msg.content);
    receivedMessage = msg;
  });

  // User A sends message
  console.log('User A sending message...');
  socketA.emit('message:send', { 
    channelId: generalChannel.id, 
    content: 'Hello Realtime!' 
  }, (res) => {
    console.log('Message send response:', res);
  });

  // Wait to see if received
  await new Promise(r => setTimeout(r, 2000));

  if (receivedMessage) {
    console.log('SUCCESS: Real-time messaging works on the backend!');
  } else {
    console.error('FAIL: Real-time messaging did NOT work.');
  }

  socketA.disconnect();
  socketB.disconnect();
  process.exit(receivedMessage ? 0 : 1);

} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
