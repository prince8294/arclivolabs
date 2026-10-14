/**
 * Bootstrap the first ADMIN account from environment variables.
 *
 * Usage:
 *   npm run seed:admin
 *
 * All input comes from the environment (.env.local / .env — the same
 * files Next.js loads in development). No credentials are hardcoded,
 * and the password is never printed to the terminal.
 *
 * Behavior:
 *   1. Validates MONGODB_URI, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL,
 *      SEED_ADMIN_PASSWORD.
 *   2. Connects to MongoDB.
 *   3. If an account with that email already exists:
 *        - ADMIN  → reports "already exists", exits cleanly (idempotent)
 *        - other  → refuses to modify it, exits with an error
 *   4. Otherwise creates the account with a bcrypt-hashed password,
 *      role ADMIN and status ACTIVE.
 */

import dotenv from 'dotenv';

// Load the same env files Next.js uses in development
// (.env.local takes precedence over .env).
dotenv.config({ path: ['.env.local', '.env'] });

async function main(): Promise<void> {
  // Deferred imports so missing-variable failures are reported before any
  // app module is loaded.
  const { isEmail } = await import('../src/lib/validations/common');
  const { BCRYPT_ROUNDS, PASSWORD_POLICY } = await import(
    '../src/lib/auth/config'
  );
  const { USER_STATUS } = await import('../src/lib/constants/enums');
  const { USER_ROLES } = await import('../src/types/auth');
  const connectDB = (await import('../src/lib/db/mongoose')).default;
  const { User } = await import('../src/models/User');
  const bcrypt = (await import('bcryptjs')).default;

  const name = process.env.SEED_ADMIN_NAME?.trim() ?? '';
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';

  const missing: string[] = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!name) missing.push('SEED_ADMIN_NAME');
  if (!email) missing.push('SEED_ADMIN_EMAIL');
  if (!password) missing.push('SEED_ADMIN_PASSWORD');

  if (missing.length > 0) {
    console.error(
      `[seed:admin] Missing required environment variable(s): ${missing.join(
        ', '
      )}. Copy .env.example to .env.local, fill in the values, and retry.`
    );
    process.exit(1);
  }

  if (!isEmail(email)) {
    console.error('[seed:admin] SEED_ADMIN_EMAIL is not a valid email address.');
    process.exit(1);
  }

  if (
    password.length < PASSWORD_POLICY.MIN_LENGTH ||
    password.length > PASSWORD_POLICY.MAX_LENGTH
  ) {
    console.error(
      `[seed:admin] SEED_ADMIN_PASSWORD must be ${PASSWORD_POLICY.MIN_LENGTH}-${PASSWORD_POLICY.MAX_LENGTH} characters long.`
    );
    process.exit(1);
  }

  if (name.length > 100) {
    console.error('[seed:admin] SEED_ADMIN_NAME is too long (max 100 characters).');
    process.exit(1);
  }

  const db = await connectDB();

  try {
    const existing = await User.findOne({ email });

    if (existing) {
      if (existing.role !== USER_ROLES.ADMIN) {
        console.error(
          `[seed:admin] An account with email ${email} already exists with ` +
            `role ${existing.role}. Refusing to modify an existing account.`
        );
        process.exit(1);
      }
      console.log(
        `[seed:admin] Admin account already exists (${email}). Nothing to do.`
      );
      process.exit(0);
    }

    // Hash the password with the same work factor as the runtime code.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await User.create({
      name,
      email,
      passwordHash,
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
    });

    console.log(`[seed:admin] Admin account created: ${email}`);
    console.log(
      '[seed:admin] Done. Sign in at /login with these credentials.'
    );
  } catch (error) {
    console.error(
      `[seed:admin] Failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  } finally {
    await db.disconnect();
  }
}

main().catch((error) => {
  console.error('[seed:admin] Unexpected failure:', error);
  process.exit(1);
});
