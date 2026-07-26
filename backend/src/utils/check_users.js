import { prisma } from '../config/prisma.js';

async function main() {
  const users = await prisma.user.findMany();
  console.log('USERS IN DB:');
  users.forEach(u => {
    console.log(`ID: ${u.id}, Username: ${u.username}, DisplayName: ${u.displayName}, AvatarColor: ${u.avatarColor}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
