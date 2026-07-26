// ============================================================================
// category.service.js
// ============================================================================
import { prisma } from '../../config/prisma.js';

export async function createCategory({ name, serverId }) {
  const last = await prisma.category.findFirst({
    where: { serverId },
    orderBy: { position: 'desc' },
  });
  const position = last ? last.position + 1 : 0;

  return prisma.category.create({
    data: { name, serverId, position },
  });
}

export async function listCategoriesForServer(serverId) {
  return prisma.category.findMany({
    where: { serverId },
    orderBy: { position: 'asc' },
  });
}

export async function renameCategory(categoryId, name) {
  return prisma.category.update({
    where: { id: categoryId },
    data: { name },
  });
}

export async function deleteCategory(categoryId) {
  // Los canales de esta categoría quedan "sueltos" (categoryId = null)
  // gracias a onDelete: SetNull en el schema; no se borran sus mensajes.
  await prisma.category.delete({ where: { id: categoryId } });
}

export async function reorderCategories({ serverId, orderedCategoryIds }) {
  await prisma.$transaction(
    orderedCategoryIds.map((categoryId, index) =>
      prisma.category.update({
        where: { id: categoryId },
        data: { position: index },
      })
    )
  );
}

export async function moveChannel({ channelId, categoryId, position }) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error('Canal no encontrado');

  const targetCategoryId = categoryId || null;
  const sourceCategoryId = channel.categoryId;

  return prisma.$transaction(async (tx) => {
    // Compactar posiciones en la categoría origen (excluyendo el canal movido)
    const sourceSiblings = await tx.channel.findMany({
      where: { serverId: channel.serverId, categoryId: sourceCategoryId, id: { not: channelId } },
      orderBy: { position: 'asc' },
    });
    for (let i = 0; i < sourceSiblings.length; i++) {
      await tx.channel.update({ where: { id: sourceSiblings[i].id }, data: { position: i } });
    }

    // Insertar en la categoría destino en la posición indicada
    const targetSiblings = await tx.channel.findMany({
      where: { serverId: channel.serverId, categoryId: targetCategoryId, id: { not: channelId } },
      orderBy: { position: 'asc' },
    });
    const clampedPosition = Math.max(0, Math.min(position, targetSiblings.length));
    targetSiblings.splice(clampedPosition, 0, channel);

    for (let i = 0; i < targetSiblings.length; i++) {
      await tx.channel.update({
        where: { id: targetSiblings[i].id },
        data: { categoryId: targetCategoryId, position: i },
      });
    }

    return tx.channel.findUnique({ where: { id: channelId } });
  });
}

export async function getCategoryById(categoryId) {
  return prisma.category.findUnique({ where: { id: categoryId } });
}
