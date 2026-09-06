import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

export async function seedDatabase() {
  const etherealUser = process.env.ETHEREAL_USER || 'lucious.kertzmann@ethereal.email';
  const etherealPass = process.env.ETHEREAL_PASS || 'h5ACW3DjH27t5BcvzX';

  console.log('🌱 Seeding database...');

  // Upsert default user
  const user = await prisma.user.upsert({
    where: { email: etherealUser },
    update: {
      name: 'Default ReachInbox User',
    },
    create: {
      googleId: 'default-mock-google-id',
      email: etherealUser,
      name: 'Default ReachInbox User',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox',
    },
  });

  // Check if sender already exists for this user
  let sender = await prisma.sender.findFirst({
    where: {
      userId: user.id,
      smtpUser: etherealUser,
    },
  });

  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        userId: user.id,
        name: 'Default Ethereal Sender',
        smtpUser: etherealUser,
        smtpPass: etherealPass,
      },
    });
  } else {
    sender = await prisma.sender.update({
      where: { id: sender.id },
      data: {
        smtpPass: etherealPass,
        name: 'Default Ethereal Sender',
      },
    });
  }

  console.log('✅ Seed completed successfully:');
  console.log(`   User: ${user.name} (${user.email}) [ID: ${user.id}]`);
  console.log(`   Sender: ${sender.name} (${sender.smtpUser}) [ID: ${sender.id}]`);

  return { user, sender };
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error('❌ Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
