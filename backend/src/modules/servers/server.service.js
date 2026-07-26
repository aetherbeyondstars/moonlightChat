// ============================================================================
// server.service.js
// Lógica de negocio para servidores (las "comunidades" tipo Discord).
// ============================================================================
import { prisma } from '../../config/prisma.js';
import * as presenceService from '../presence/presence.service.js';

const DEFAULT_CHANNELS = ['general'];

async function getNextPosition(userId) {
  const last = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { position: 'desc' },
  });
  return last ? last.position + 1 : 0;
}

export async function createServer({ name, ownerId }) {
  const position = await getNextPosition(ownerId);
  const server = await prisma.server.create({
    data: {
      name,
      ownerId,
      channels: {
        create: DEFAULT_CHANNELS.map((channelName, i) => ({
          name: channelName,
          position: i,
        })),
      },
      memberships: {
        create: {
          userId: ownerId,
          role: 'OWNER',
          position,
        },
      },
    },
    include: { channels: true },
  });

  return server;
}

export async function listServersForUser(userId) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    include: {
      server: {
        include: {
          channels: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  return memberships.map((m) => m.server);
}

export async function joinServerByInviteCode({ inviteCode, userId }) {
  const server = await prisma.server.findUnique({ where: { inviteCode } });
  if (!server) {
    throw new Error('Código de invitación inválido');
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_serverId: { userId, serverId: server.id } },
  });
  if (existing) {
    return server; // ya es miembro, no hacemos nada
  }

  const position = await getNextPosition(userId);
  await prisma.membership.create({
    data: { userId, serverId: server.id, role: 'MEMBER', position },
  });

  return server;
}

export async function reorderServers({ userId, orderedServerIds }) {
  // Actualiza la posición de cada membership del usuario según el nuevo orden.
  // Se hace en una transacción para que quede consistente.
  await prisma.$transaction(
    orderedServerIds.map((serverId, index) =>
      prisma.membership.update({
        where: { userId_serverId: { userId, serverId } },
        data: { position: index },
      })
    )
  );
}

export async function getServerMembers(serverId) {
  const memberships = await prisma.membership.findMany({
    where: { serverId },
    include: { user: true },
  });

  return memberships.map((m) => {
    const isOnline = presenceService.isOnline(m.user.id);
    const effectiveStatus = isOnline ? (m.user.manualStatus || 'online') : 'offline';

    return {
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      avatarColor: m.user.avatarColor,
      avatarUrl: m.user.avatarUrl,
      status: effectiveStatus,
      manualStatus: m.user.manualStatus,
      role: m.role,
      joinedAt: m.joinedAt,
      customStatus: m.user.customStatus,
      bio: m.user.bio,
      badges: m.user.badges,
    };
  });
}

export async function inviteFriendToServer({ inviterId, friendId, serverId }) {
  const isInviterMember = await isMember(inviterId, serverId);
  if (!isInviterMember) {
    throw new Error('No eres miembro de este servidor');
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_serverId: { userId: friendId, serverId } },
  });
  if (existing) {
    throw new Error('Esa persona ya es miembro del servidor');
  }

  const server = await getServerById(serverId);
  const memberCount = await prisma.membership.count({ where: { serverId } });

  return {
    inviteCode: server.inviteCode,
    server: {
      id: server.id,
      name: server.name,
      iconUrl: server.iconUrl,
      iconColor: server.iconColor,
      bannerUrl: server.bannerUrl,
      memberCount,
    },
  };
}

export async function getServerInvitePreview(inviteCode) {
  const server = await prisma.server.findUnique({ where: { inviteCode } });
  if (!server) throw new Error('Invitación inválida o expirada');

  const memberCount = await prisma.membership.count({ where: { serverId: server.id } });

  return {
    id: server.id,
    name: server.name,
    iconUrl: server.iconUrl,
    iconColor: server.iconColor,
    bannerUrl: server.bannerUrl,
    memberCount,
    inviteCode: server.inviteCode,
  };
}

export async function getServerById(serverId) {
  return prisma.server.findUnique({ where: { id: serverId } });
}

export async function leaveServer({ userId, serverId }) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    throw new Error('Servidor no encontrado');
  }
  if (server.ownerId === userId) {
    throw new Error('El propietario no puede salir de su propio servidor. Elimínalo o transfiere la propiedad.');
  }

  await prisma.membership.delete({
    where: { userId_serverId: { userId, serverId } },
  });
}

export async function deleteServer({ userId, serverId }) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) {
    throw new Error('Servidor no encontrado');
  }
  if (server.ownerId !== userId) {
    throw new Error('Solo el propietario puede eliminar el servidor');
  }

  await prisma.server.delete({ where: { id: serverId } });
}

export async function isMember(userId, serverId) {
  const membership = await prisma.membership.findUnique({
    where: { userId_serverId: { userId, serverId } },
  });
  return Boolean(membership);
}
 
export async function updateServer(serverId, { name }) {
  return prisma.server.update({
    where: { id: serverId },
    data: { name },
  });
}
