/**
 * Seeds demo data through the real service layer so the event log, timeline,
 * dashboard and alerts are all realistically populated. A few completions are
 * then backdated so the 8-week chart has history.
 *
 *   npm run seed        (destructive: resets schema first)
 */
import { db, pool } from './index';
import type { AuthUser } from '../types/express';
import { hashPassword } from '../lib/password';
import * as projects from '../modules/projects/projects.service';
import * as tasks from '../modules/tasks/tasks.service';
import { addComment } from '../modules/tasks/tasks.timeline';
import type { Role } from './types';

const PASSWORD = 'password123';

async function createUser(email: string, name: string, role: Role): Promise<AuthUser> {
  const passwordHash = await hashPassword(PASSWORD);
  const row = await db
    .insertInto('users')
    .values({ email, name, role, password_hash: passwordHash })
    .returning(['id', 'email', 'name', 'role'])
    .executeTakeFirstOrThrow();
  return row;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

async function drive(user: AuthUser, taskId: string, statuses: string[]): Promise<void> {
  for (const s of statuses) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tasks.transitionTask(user, taskId, s as any);
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Resetting schema…');
  const { execSync } = await import('node:child_process');
  execSync('tsx src/db/migrate.ts reset', { stdio: 'inherit' });

  console.log('Seeding users…');
  const maya = await createUser('manager@tasktracker.dev', 'Maya (Manager)', 'MANAGER');
  const alice = await createUser('alice@tasktracker.dev', 'Alice Chen', 'MEMBER');
  const bob = await createUser('bob@tasktracker.dev', 'Bob Ortiz', 'MEMBER');
  const carol = await createUser('carol@tasktracker.dev', 'Carol Singh', 'MEMBER');

  console.log('Seeding projects…');
  const web = await projects.createProject(maya, { name: 'Website Revamp', description: 'Rebuild the marketing site for Q3.', memberIds: [alice.id, bob.id] });
  const app = await projects.createProject(maya, { name: 'Mobile App v2', description: 'Native app refresh with offline support.', memberIds: [bob.id, carol.id] });
  const ops = await projects.createProject(maya, { name: 'Internal Ops', description: 'Back-office tooling and automation.', memberIds: [alice.id] });

  console.log('Seeding tasks…');
  const t = async (
    project: { id: string },
    title: string,
    opts: { priority?: string; due?: number; assignees?: AuthUser[]; deps?: string[]; description?: string } = {},
  ) => {
    const detail = await tasks.createTask(maya, project.id, {
      title,
      description: opts.description ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: (opts.priority ?? 'MEDIUM') as any,
      dueDate: opts.due !== undefined ? daysFromNow(opts.due) : undefined,
      assigneeIds: (opts.assignees ?? []).map((u) => u.id),
      dependencyIds: opts.deps ?? [],
    });
    return detail.id;
  };

  // Website Revamp
  const design = await t(web, 'Design new homepage', { priority: 'HIGH', due: 5, assignees: [alice], description: 'Wireframes + hi-fi mockups.' });
  const build = await t(web, 'Build homepage components', { priority: 'HIGH', due: 12, assignees: [bob], deps: [design] });
  const content = await t(web, 'Write homepage copy', { priority: 'MEDIUM', due: -2, assignees: [alice] }); // overdue
  await t(web, 'Set up analytics', { priority: 'LOW', due: 20, assignees: [bob] });
  const launch = await t(web, 'Launch checklist', { priority: 'URGENT', due: 25, assignees: [alice, bob], deps: [build, content] });

  // drive some through lifecycle (creates STATUS_CHANGED events + completions)
  await drive(alice, design, ['IN_PROGRESS', 'IN_REVIEW', 'DONE']);
  await drive(bob, build, ['IN_PROGRESS']);
  await addComment(alice, content, 'Draft is with legal for review.');
  await addComment(maya, launch, 'Blocked until build + copy are done — expected.');

  // Mobile App v2
  const api = await t(app, 'Design sync API', { priority: 'URGENT', due: 3, assignees: [bob], description: 'Offline-first conflict resolution.' });
  const offline = await t(app, 'Implement offline cache', { priority: 'HIGH', due: 15, assignees: [carol], deps: [api] });
  await t(app, 'Push notifications', { priority: 'MEDIUM', due: -5, assignees: [carol] }); // overdue
  await drive(bob, api, ['IN_PROGRESS', 'IN_REVIEW', 'DONE']);
  await drive(carol, offline, ['IN_PROGRESS']);

  // Internal Ops — a batch of completed tasks to give the chart history
  const completed: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = await t(ops, `Automate report #${i + 1}`, { priority: 'MEDIUM', assignees: [alice] });
    await drive(alice, id, ['IN_PROGRESS', 'IN_REVIEW', 'DONE']);
    completed.push(id);
  }

  console.log('Backdating some completions for the 8-week chart…');
  // Spread completions across the past 8 weeks.
  for (let i = 0; i < completed.length; i++) {
    const weeksAgo = i % 8;
    const when = new Date();
    when.setUTCDate(when.getUTCDate() - weeksAgo * 7 - 1);
    await db.updateTable('tasks').set({ completed_at: when }).where('id', '=', completed[i]).execute();
  }

  console.log('\nSeed complete. Demo accounts (password: ' + PASSWORD + '):');
  console.log('  manager@tasktracker.dev   (Manager)');
  console.log('  alice@tasktracker.dev     (Member)');
  console.log('  bob@tasktracker.dev       (Member)');
  console.log('  carol@tasktracker.dev     (Member)');

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
