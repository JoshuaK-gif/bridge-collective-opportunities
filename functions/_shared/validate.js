import { z } from 'zod';

/** Parse a body with a zod schema; returns { ok, data, error } — never throws. */
export function parseWith(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.errors[0];
    return {
      ok: false,
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed',
      details: result.error.errors,
    };
  }
  return { ok: true, data: result.data };
}

export const opportunitySchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(100000, 'Description too long').optional().default(''),
  link: z.string().url('Invalid URL').optional().or(z.literal('')).default(''),
  image_url: z.string().url('Invalid image URL').optional().or(z.literal('')).default(''),
  image_public_id: z.string().max(500).optional().default(''),
  image_crop: z.any().optional(),
  image_size: z.string().optional().default('medium'),
  category: z.string().max(100).optional().default(''),
  deadline: z.string().max(50).optional().default(''),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional().default(''),
  icon: z.string().optional().default('Briefcase'),
  color: z.string().optional().default('text-blue-600 bg-blue-100'),
  accent: z.string().optional().default('bg-blue-500'),
  accent_bg: z.string().optional().default('bg-blue-50'),
});

export const messageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Subject is required').max(500),
  message: z.string().min(1, 'Message is required').max(10000),
});

export const subscriberSchema = z.object({
  email: z.string().email('Invalid email'),
  source_page: z.string().optional().default(''),
  referrer: z.string().optional().default(''),
});

export const listSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional().default(''),
});

export const listItemSchema = z.object({
  opportunity_id: z.string().uuid('Invalid opportunity ID'),
});

export default { parseWith, opportunitySchema, categorySchema, messageSchema, subscriberSchema, listSchema, listItemSchema };
