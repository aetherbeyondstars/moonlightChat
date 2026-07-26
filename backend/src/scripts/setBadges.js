// ============================================================================
// setBadges.js
// Asigna o quita insignias globales a un usuario por su nombre de usuario.
// Uso: npm run set-badges <username> HOST_OWNER,INSTANCE_ADMIN,BUG_HUNTER
// Para borrar insignias: npm run set-badges <username> clear
// ============================================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_BADGES = ['HOST_OWNER', 'INSTANCE_ADMIN', 'BUG_HUNTER'];

async function main() {
  const args = process.argv.slice(2);
  const username = args[0]?.toLowerCase()?.trim();
  const badgesArg = args[1];

  if (!username) {
    console.log('\n❌ Uso incorrecto del comando.');
    console.log('📌 Formato: npm run set-badges <username> HOST_OWNER,INSTANCE_ADMIN,BUG_HUNTER');
    console.log('📌 Para quitar insignias: npm run set-badges <username> clear');
    console.log(`📌 Insignias disponibles: ${VALID_BADGES.join(', ')}\n`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.log(`\n❌ Error: El usuario "@${username}" no existe en la base de datos.\n`);
    process.exit(1);
  }

  let newBadges = [];
  if (badgesArg && badgesArg !== 'none' && badgesArg !== 'clear') {
    const list = badgesArg.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    newBadges = list.filter((b) => VALID_BADGES.includes(b));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { badges: JSON.stringify(newBadges) },
  });

  console.log(`\n✅ Insignias actualizadas con éxito para el usuario @${user.username}:`);
  console.log(`   Insignias asignadas: ${newBadges.length > 0 ? newBadges.join(', ') : 'Ninguna (Limpiado)'}\n`);
}

main()
  .catch((e) => {
    console.error('Error al actualizar insignias:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
