import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Too long'),
  description: z.string().max(500, 'Too long').optional().or(z.literal('')),
  language: z.enum(['javascript', 'typescript', 'python']),
});

export const reviewSchema = z.object({
  project_id: z.string().uuid('Select a project'),
  review_type: z.enum(['monaco', 'upload']),
  language: z.enum(['javascript', 'typescript', 'python']),
  file_name: z.string().min(1, 'File name is required'),
  source_code: z.string().min(1, 'Source code is required').max(500_000, 'Code too large'),
});

export const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Too long'),
  avatar_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
