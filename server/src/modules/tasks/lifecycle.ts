import type { TaskStatus } from '../../db/types';
import { unprocessable } from '../../lib/errors';

/**
 * The task lifecycle state machine. This is the single source of truth for
 * which status transitions are legal; it is enforced server-side on every
 * transition request regardless of what the client sends.
 *
 *   TODO ─▶ IN_PROGRESS ─▶ IN_REVIEW ─▶ DONE
 *     │         │  ▲          │  ▲        │
 *     │         ▼  │          ▼  │        │ (reopen)
 *     └────────▶ CANCELLED ◀──┴─────┐     ▼
 *                    │ (reopen)     └─ IN_PROGRESS
 *                    ▼
 *                  TODO
 */
export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'TODO', 'CANCELLED'],
  IN_REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE: ['IN_PROGRESS'], // reopen a completed task
  CANCELLED: ['TODO'], // reopen a cancelled task
};

/** Statuses that mean "work has started/finished" and therefore require all
 *  blocking dependencies to be DONE first. A blocked task may only sit in
 *  TODO or CANCELLED. */
const REQUIRES_UNBLOCKED: TaskStatus[] = ['IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function requiresUnblocked(to: TaskStatus): boolean {
  return REQUIRES_UNBLOCKED.includes(to);
}

/** Throws 422 if the transition is not permitted by the state machine. */
export function assertValidTransition(from: TaskStatus, to: TaskStatus): void {
  if (from === to) {
    throw unprocessable(`Task is already ${to}`);
  }
  if (!isValidTransition(from, to)) {
    throw unprocessable(`Cannot move a task from ${from} to ${to}`, {
      from,
      to,
      allowed: TRANSITIONS[from],
    });
  }
}
