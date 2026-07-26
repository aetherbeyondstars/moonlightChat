// ============================================================================
// channel.service.js
// ============================================================================
import { prisma } from '../../config/prisma.js';

export async function createChannel({ name, serverId, type = 'TEXT', categoryId = null }) {
  const lastChannel = await prisma.channel.findFirst({
    where: { serverId, categoryId },
    orderBy: { position: 'desc' },
  });

  const position = lastChannel ? lastChannel.position + 1 : 0;

  return prisma.channel.create({
    data: { name, serverId, type, position, categoryId },
  });
}

export async function listChannelsForServer(serverId) {
  return prisma.channel.findMany({
    where: { serverId },
    orderBy: { position: 'asc' },
  });
}

export async function getChannelById(channelId) {
  return prisma.channel.findUnique({
    where: { id: channelId },
    include: { server: true },
  });
}

export async function renameChannel(channelId, name, userLimit) {
  const data = {};
  if (name !== undefined) data.name = name;
  if (userLimit !== undefined) data.userLimit = parseInt(userLimit, 10) || 0;

  return prisma.channel.update({
    where: { id: channelId },
    data,
  });
}

export async function deleteChannel(channelId) {
  await prisma.channel.delete({ where: { id: channelId } });
}
