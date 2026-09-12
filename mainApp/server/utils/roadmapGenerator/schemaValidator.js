const { z } = require('zod');

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (expected YYYY-MM-DD)')
  .refine((d) => {
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
  }, 'Invalid calendar date');

const inputSchema = z.object({
  project: z.object({
    name: z.string().trim().min(1, 'Project name is required').max(200, 'Project name too long'),
    description: z.string().max(1000, 'Description too long').default(''),
    startDate: dateKey,
    deadline: dateKey,
  }),
  schedule: z.object({
    workingDays: z.array(z.enum(DAY_NAMES)).min(1, 'At least one working day required').max(7),
    hoursPerDay: z.number().min(0.5, 'hoursPerDay must be at least 0.5').max(12, 'hoursPerDay must be at most 12'),
    bufferDays: z.number().int().min(0).max(30).default(2),
  }),
  rules: z.object({
    includeRevision: z.boolean().default(true),
    includePractice: z.boolean().default(true),
    includeProjects: z.boolean().default(true),
    includeQuiz: z.boolean().default(true),
    includeSubtasks: z.boolean().default(true),
    defaultSubtaskCount: z.number().int().min(0).max(5).default(2),
    defaultTaskHours: z.number().min(0.5).max(8).default(1.5),
    milestoneGroupSize: z.number().int().min(1).max(10).default(4),
  }).default({}),
  phases: z.array(z.object({
    name: z.string().trim().min(1, 'Phase name is required').max(200, 'Phase name too long'),
    description: z.string().max(1000, 'Description too long').default(''),
    topics: z.array(z.object({
      title: z.string().trim().min(1, 'Topic title is required'),
      estimatedHours: z.number().min(0.25).max(12).optional(),
      priority: z.enum(PRIORITY_VALUES).default('medium'),
      subtopics: z.array(z.string().trim().min(1)).optional(),
    })).min(1, 'At least one topic required per phase'),
  })).min(1, 'At least one phase required'),
}).refine(
  (data) => new Date(data.project.deadline) > new Date(data.project.startDate),
  { message: 'deadline must be after startDate', path: ['project', 'deadline'] }
);

function validateInput(json) {
  const result = inputSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
}

module.exports = { validateInput, inputSchema };
