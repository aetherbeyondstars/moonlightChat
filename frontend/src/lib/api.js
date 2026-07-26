import { getServerUrl } from './serverConfig';

async function request(path, { method = 'GET', body, token } = {}) {
  const baseUrl = getServerUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Error de red');
  }

  return data;
}

// Subida de archivos: usa FormData en vez de JSON, así que no pasa por
// el helper `request` (que siempre serializa el body como JSON).
async function uploadFile(path, file, token) {
  const baseUrl = getServerUrl();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error al subir el archivo');
  }
  return data;
}

// Construye la URL completa de un archivo subido (las rutas que devuelve
// el backend son relativas, ej. "/uploads/avatars/xxx.png").
export function resolveUploadUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const baseUrl = getServerUrl();
  return `${baseUrl}${path}`;
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),

  listServers: (token) => request('/api/servers', { token }),
  createServer: (body, token) => request('/api/servers', { method: 'POST', body, token }),
  joinServer: (body, token) => request('/api/servers/join', { method: 'POST', body, token }),
  reorderServers: (orderedServerIds, token) =>
    request('/api/servers/reorder', { method: 'POST', body: { orderedServerIds }, token }),
  getServer: (serverId, token) => request(`/api/servers/${serverId}`, { token }),
  updateServer: (serverId, body, token) => request(`/api/servers/${serverId}`, { method: 'PATCH', body, token }),
  leaveServer: (serverId, token) =>
    request(`/api/servers/${serverId}/leave`, { method: 'POST', token }),
  deleteServer: (serverId, token) =>
    request(`/api/servers/${serverId}`, { method: 'DELETE', token }),
  listMembers: (serverId, token) => request(`/api/servers/${serverId}/members`, { token }),
  inviteFriendToServer: (serverId, friendId, token) =>
    request(`/api/servers/${serverId}/invite-friend`, { method: 'POST', body: { friendId }, token }),

  listChannels: (serverId, token) => request(`/api/channels/server/${serverId}`, { token }),
  createChannel: (body, token) => request('/api/channels', { method: 'POST', body, token }),
  renameChannel: (channelId, name, token, userLimit) =>
    request(`/api/channels/${channelId}`, { method: 'PATCH', body: { name, userLimit }, token }),
  deleteChannel: (channelId, token) =>
    request(`/api/channels/${channelId}`, { method: 'DELETE', token }),

  listMessages: (channelId, token) => request(`/api/messages/channel/${channelId}`, { token }),
  editMessage: (messageId, content, token) =>
    request(`/api/messages/${messageId}`, { method: 'PATCH', body: { content }, token }),
  deleteMessage: (messageId, token) =>
    request(`/api/messages/${messageId}`, { method: 'DELETE', token }),
  toggleReaction: (messageId, emoji, token) =>
    request(`/api/messages/${messageId}/reactions`, { method: 'POST', body: { emoji }, token }),

  getProfile: (userId, token) => request(`/api/users/${userId}`, { token }),
  updateProfile: (body, token) => request('/api/users/me', { method: 'PATCH', body, token }),

  // Categorías
  listCategories: (serverId, token) => request(`/api/categories/server/${serverId}`, { token }),
  createCategory: (body, token) => request('/api/categories', { method: 'POST', body, token }),
  renameCategory: (categoryId, name, token) =>
    request(`/api/categories/${categoryId}`, { method: 'PATCH', body: { name }, token }),
  deleteCategory: (categoryId, token) =>
    request(`/api/categories/${categoryId}`, { method: 'DELETE', token }),
  reorderCategories: (serverId, orderedCategoryIds, token) =>
    request('/api/categories/reorder', { method: 'POST', body: { serverId, orderedCategoryIds }, token }),
  moveChannel: (channelId, categoryId, position, token) =>
    request(`/api/categories/channel/${channelId}/move`, {
      method: 'PATCH', body: { categoryId, position }, token,
    }),

  // Amigos
  listFriends: (token) => request('/api/friends', { token }),
  listFriendRequests: (token) => request('/api/friends/requests', { token }),
  sendFriendRequest: (username, token) =>
    request('/api/friends/requests', { method: 'POST', body: { username }, token }),
  acceptFriendRequest: (requestId, token) =>
    request(`/api/friends/requests/${requestId}/accept`, { method: 'POST', token }),
  declineFriendRequest: (requestId, token) =>
    request(`/api/friends/requests/${requestId}/decline`, { method: 'POST', token }),
  removeFriend: (friendId, token) =>
    request(`/api/friends/${friendId}`, { method: 'DELETE', token }),

  // Mensajes directos
  listConversations: (token) => request('/api/dm/conversations', { token }),
  openConversation: (otherUserId, token) =>
    request('/api/dm/conversations', { method: 'POST', body: { userId: otherUserId }, token }),
  closeConversation: (conversationId, token) =>
    request(`/api/dm/conversations/${conversationId}`, { method: 'DELETE', token }),
  listDMMessages: (conversationId, token) =>
    request(`/api/dm/conversations/${conversationId}/messages`, { token }),
  toggleDMReaction: (messageId, emoji, token) =>
    request(`/api/dm/messages/${messageId}/reactions`, { method: 'POST', body: { emoji }, token }),

  // Subida de archivos
  uploadAvatar: (file, token) => uploadFile('/api/uploads/avatar', file, token),
  uploadBanner: (file, token) => uploadFile('/api/uploads/banner', file, token),
  uploadServerIcon: (serverId, file, token) =>
    uploadFile(`/api/uploads/server/${serverId}/icon`, file, token),
  uploadMessageImage: (file, token) => uploadFile('/api/uploads/message-image', file, token),

  // Notificaciones
  listUnreadNotifications: (token) => request('/api/notifications/unread', { token }),
  markServerNotificationsRead: (serverId, token) =>
    request(`/api/notifications/server/${serverId}/read`, { method: 'POST', token }),
  markConversationNotificationsRead: (conversationId, token) =>
    request(`/api/notifications/conversation/${conversationId}/read`, { method: 'POST', token }),
  markChannelNotificationsRead: (channelId, token) =>
    request(`/api/notifications/channel/${channelId}/read`, { method: 'POST', token }),

  // Voz/video (WebRTC)
  getIceServers: (token) => request('/api/voice/ice-servers', { token }),

  getInvitePreview: (inviteCode) => request(`/api/servers/invite/${inviteCode}/preview`),
};
