import { z } from 'zod';

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .nullable();

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).trim().optional().default(''),
  priority: z.enum(PRIORITIES).optional().default('MEDIUM'),
  dueDate: isoDate.optional(),
  assigneeIds: z.array(z.string().uuid()).optional().default([]),
  dependencyIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(5000).trim().optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: isoDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const transitionSchema = z.object({
  status: z.enum(STATUSES),
});

export const assignSchema = z.object({
  userId: z.string().uuid(),
});

export const addDependencySchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
