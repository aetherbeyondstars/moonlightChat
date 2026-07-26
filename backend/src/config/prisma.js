// ============================================================================
// Cliente Prisma único para toda la aplicación.
// Evita crear múltiples conexiones a la base de datos (mala práctica común
// en proyectos Node con hot-reload).
// ============================================================================
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
