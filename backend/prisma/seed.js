// ============================================================================
// prisma/seed.js
// Script de datos iniciales (vacío por defecto para no crear cuentas de prueba).
// Ejecutar con: npm run seed
// ============================================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Sin usuarios por defecto creados automáticamente
  console.log('✅ Base de datos lista.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
