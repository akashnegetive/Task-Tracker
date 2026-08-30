import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import { hashPassword, verifyPassword } from '../../lib/password';
import { conflict, unauthorized } from '../../lib/errors';
import type { RegisterInput, LoginInput } from './auth.schemas';

const publicColumns = ['id', 'email', 'name', 'role'] as const;

/**
 * Registers a user. Bootstrap rule: the very first account created in an empty
 * system becomes a MANAGER (so the app is usable out of the box); everyone who
 * self-registers afterwards is a MEMBER. Managers grant elevated access to
 * others explicitly (membership + user creation), never via self-signup.
 */
export async function register(input: RegisterInput): Promise<AuthUser> {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', input.email)
    .executeTakeFirst();
  if (existing) throw conflict('An account with this email already exists');

  const userCount = await db
    .selectFrom('users')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .executeTakeFirst();
  const isFirstUser = Number(userCount?.count ?? 0) === 0;

  const passwordHash = await hashPassword(input.password);

  const user = await db
    .insertInto('users')
    .values({
      email: input.email,
      password_hash: passwordHash,
      name: input.name,
      role: isFirstUser ? 'MANAGER' : 'MEMBER',
    })
    .returning(publicColumns)
    .executeTakeFirstOrThrow();

  return user;
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const user = await db
    .selectFrom('users')
    .select([...publicColumns, 'password_hash'])
    .where('email', '=', input.email)
    .executeTakeFirst();

  // Same error whether the email is unknown or the password is wrong.
  if (!user) throw unauthorized('Invalid email or password');
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) throw unauthorized('Invalid email or password');

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
