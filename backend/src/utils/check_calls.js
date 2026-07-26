import { prisma } from '../config/prisma.js';

async function main() {
  console.log('--- CALL LOGS ---');
  const logs = await prisma.callLog.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(logs, null, 2));

  console.log('--- DM MESSAGES ---');
  const messages = await prisma.dMMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(messages, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
