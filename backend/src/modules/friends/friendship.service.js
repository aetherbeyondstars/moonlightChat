// ============================================================================
// friendship.service.js
// ============================================================================
import { prisma } from '../../config/prisma.js';

const USER_PUBLIC_SELECT = {
  id: true, username: true, displayName: true, avatarColor: true, avatarUrl: true, status: true,
};

export async function sendFriendRequest({ senderId, receiverUsername }) {
  const normalizedUsername = receiverUsername?.toLowerCase().trim();
  if (!normalizedUsername) {
    throw new Error('Nombre de usuario no válido');
  }
  const receiver = await prisma.user.findUnique({ where: { username: normalizedUsername } });
  if (!receiver) {
    throw new Error('No existe ningún usuario con ese nombre');
  }
  if (receiver.id === senderId) {
    throw new Error('No puedes enviarte una solicitud a ti mismo');
  }

  const alreadyFriends = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: senderId, friendId: receiver.id } },
  });
  if (alreadyFriends) {
    throw new Error('Ya sois amigos');
  }

  // Si la otra persona ya te había enviado una solicitud, la aceptamos
  // directamente en vez de crear una segunda solicitud cruzada.
  const incoming = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId: receiver.id, receiverId: senderId } },
  });
  if (incoming) {
    return acceptFriendRequest({ requestId: incoming.id, userId: senderId });
  }

  const existing = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId, receiverId: receiver.id } },
  });
  if (existing) {
    throw new Error('Ya le has enviado una solicitud a este usuario');
  }

  const request = await prisma.friendRequest.create({
    data: { senderId, receiverId: receiver.id },
    include: { receiver: { select: USER_PUBLIC_SELECT }, sender: { select: USER_PUBLIC_SELECT } },
  });

  return { request, receiverId: receiver.id };
}

export async function acceptFriendRequest({ requestId, userId }) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Solicitud no encontrada');
  if (request.receiverId !== userId) throw new Error('No puedes aceptar esta solicitud');

  await prisma.$transaction([
    prisma.friendship.create({
      data: { userId: request.senderId, friendId: request.receiverId },
    }),
    prisma.friendship.create({
      data: { userId: request.receiverId, friendId: request.senderId },
    }),
    prisma.friendRequest.delete({ where: { id: requestId } }),
  ]);

  return { senderId: request.senderId, receiverId: request.receiverId };
}

export async function declineFriendRequest({ requestId, userId }) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Solicitud no encontrada');
  if (request.receiverId !== userId && request.senderId !== userId) {
    throw new Error('No puedes gestionar esta solicitud');
  }
  await prisma.friendRequest.delete({ where: { id: requestId } });
  return { senderId: request.senderId, receiverId: request.receiverId };
}

export async function removeFriend({ userId, friendId }) {
  await prisma.$transaction([
    prisma.friendship.deleteMany({ where: { userId, friendId } }),
    prisma.friendship.deleteMany({ where: { userId: friendId, friendId: userId } }),
  ]);
}

export async function listFriends(userId) {
  const friendships = await prisma.friendship.findMany({
    where: { userId },
    include: { friend: { select: USER_PUBLIC_SELECT } },
    orderBy: { createdAt: 'asc' },
  });
  return friendships.map((f) => f.friend);
}

export async function listIncomingRequests(userId) {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: userId },
    include: { sender: { select: USER_PUBLIC_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map((r) => ({ id: r.id, user: r.sender, createdAt: r.createdAt }));
}

export async function listOutgoingRequests(userId) {
  const requests = await prisma.friendRequest.findMany({
    where: { senderId: userId },
    include: { receiver: { select: USER_PUBLIC_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
  return requests.map((r) => ({ id: r.id, user: r.receiver, createdAt: r.createdAt }));
}

export async function areFriends(userId, otherUserId) {
  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId, friendId: otherUserId } },
  });
  return Boolean(friendship);
}
