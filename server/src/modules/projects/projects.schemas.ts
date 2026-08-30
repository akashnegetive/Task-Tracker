import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(160).trim(),
  description: z.string().max(2000).trim().optional().default(''),
  memberIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(160).trim().optional(),
    description: z.string().max(2000).trim().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: 'Provide at least one field to update',
  });

export const listProjectsQuery = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).optional().default('ACTIVE'),
  search: z.string().trim().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;
