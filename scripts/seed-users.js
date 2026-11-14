import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../src/db/mongoose.js';
import User, { USER_ROLES } from '../src/models/User.js';

const password = process.env.SEED_PASSWORD;
if (!password) {
  throw new Error('SEED_PASSWORD is required');
}

await connectToDatabase();
const passwordHash = await bcrypt.hash(password, 12);
const users = USER_ROLES.map((role) => ({
  name: `Dummy ${role} User`,
  email: `${role.toLowerCase()}@example.test`,
  passwordHash,
  role,
}));

await User.deleteMany({ email: { $in: users.map(({ email }) => email) } });
await User.insertMany(users);
process.stdout.write(`Seeded ${users.length} dummy users\n`);
await User.db.close();
