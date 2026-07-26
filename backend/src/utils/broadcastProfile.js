// ============================================================================
// broadcastProfile.js — emite profile:updated a servidores y amigos del usuario
// ============================================================================
import * as serverService from '../modules/servers/server.service.js';
import * as friendshipService from '../modules/friends/friendship.service.js';

export async function broadcastProfileUpdate(io, userId, profile) {
  if (!io) return;

  const servers = await serverService.listServersForUser(userId);
  for (const server of servers) {
    io.to(`server:${server.id}`).emit('profile:updated', profile);
  }

  const friends = await friendshipService.listFriends(userId);
  for (const friend of friends) {
    io.to(`user:${friend.id}`).emit('profile:updated', profile);
  }

  io.to(`user:${userId}`).emit('profile:updated', profile);
}
