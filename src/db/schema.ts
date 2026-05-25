import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────

export const testRunStatusEnum = pgEnum('test_run_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

export const testResultStatusEnum = pgEnum('test_result_status', [
  'passed',
  'failed',
  'warning',
  'pending',
]);

export const severityEnum = pgEnum('severity', [
  'critical',
  'high',
  'medium',
  'low',
]);

export const findingStatusEnum = pgEnum('finding_status', [
  'open',
  'fixed',
  'ignored',
]);

// ─── Projects ─────────────────────────────────────────────────────────────
// userId is the owner (FK -> users.id). Nullable so anonymous/historical
// rows aren't broken, but new API writes always set it from the session JWT.

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    repoUrl: text('repo_url'),
    localPath: text('local_path').notNull(),
    branch: varchar('branch', { length: 100 }).default('main').notNull(),
    techStack: jsonb('tech_stack').default([]).$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // (user_id, name) is unique per user, so two users can have repos with the same name
    uniqueIndex('projects_user_name_idx').on(table.userId, table.name),
    index('projects_user_id_idx').on(table.userId),
    index('projects_repo_url_idx').on(table.repoUrl),
  ]
);

// ─── Users ────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    githubId: varchar('github_id', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    avatarUrl: text('avatar_url'),
    login: varchar('login', { length: 100 }).notNull(),
    plan: varchar('plan', { length: 20 }).default('free').notNull(),
    // Stripe customer id is set the first time the user upgrades; used by
    // the Customer Portal link and by the webhook to identify which user
    // a billing event belongs to.
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    testsRun: integer('tests_run').default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_github_id_idx').on(table.githubId),
    index('users_email_idx').on(table.email),
    index('users_stripe_customer_id_idx').on(table.stripeCustomerId),
  ]
);

// ─── Stripe events (webhook idempotency) ─────────────────────────────────
// Insert each Stripe event id on first receipt. The PK conflict on a
// repeat delivery is the idempotency check — no double-upgrades.

export const stripeEvents = pgTable('stripe_events', {
  id: varchar('id', { length: 100 }).primaryKey(),
  type: varchar('type', { length: 80 }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Organizations ───────────────────────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    plan: varchar('plan', { length: 20 }).default('free').notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('orgs_slug_idx').on(table.slug)]
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('memberships_user_org_idx').on(table.userId, table.organizationId),
  ]
);

// ─── Test Runs ────────────────────────────────────────────────────────────

export const testRuns = pgTable(
  'test_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    // Denormalized owner reference — also derivable via projects.userId, but
    // /api/history filters test_runs directly by user, so an index here matters.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    branch: varchar('branch', { length: 100 }).notNull(),
    commitHash: varchar('commit_hash', { length: 40 }),
    status: testRunStatusEnum('status').notNull(),
    overallScore: integer('overall_score'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    config: jsonb('config').default({}),
    totalFindings: integer('total_findings').default(0).notNull(),
    criticalCount: integer('critical_count').default(0).notNull(),
    highCount: integer('high_count').default(0).notNull(),
    mediumCount: integer('medium_count').default(0).notNull(),
    lowCount: integer('low_count').default(0).notNull(),
  },
  (table) => [
    index('test_runs_project_id_idx').on(table.projectId),
    index('test_runs_user_id_idx').on(table.userId),
    index('test_runs_status_idx').on(table.status),
    index('test_runs_branch_idx').on(table.branch),
  ]
);

// ─── Test Results (one per dimension per run) ─────────────────────────────

export const testResults = pgTable(
  'test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testRunId: uuid('test_run_id')
      .references(() => testRuns.id, { onDelete: 'cascade' })
      .notNull(),
    dimension: varchar('dimension', { length: 50 }).notNull(),
    dimensionLabel: varchar('dimension_label', { length: 100 }),
    status: testResultStatusEnum('status'),
    durationMs: integer('duration_ms'),
    metrics: jsonb('metrics'),
    logs: jsonb('logs'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('test_results_test_run_id_idx').on(table.testRunId),
    index('test_results_dimension_idx').on(table.dimension),
  ]
);

// ─── Findings (vulnerabilities, issues) ───────────────────────────────────

export const findings = pgTable(
  'findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testRunId: uuid('test_run_id')
      .references(() => testRuns.id, { onDelete: 'cascade' })
      .notNull(),
    dimension: varchar('dimension', { length: 50 }).notNull(),
    severity: severityEnum('severity'),
    title: text('title').notNull(),
    description: text('description'),
    filePath: text('file_path'),
    lineNumber: integer('line_number'),
    cveId: varchar('cve_id', { length: 50 }),
    exploitability: text('exploitability'),
    fixSuggestion: text('fix_suggestion'),
    status: findingStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('findings_test_run_id_idx').on(table.testRunId),
    index('findings_dimension_idx').on(table.dimension),
    index('findings_severity_idx').on(table.severity),
    index('findings_status_idx').on(table.status),
  ]
);

// ─── Reports (generated PRDs) ─────────────────────────────────────────────

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    testRunId: uuid('test_run_id')
      .references(() => testRuns.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    content: jsonb('content').notNull(),
    format: varchar('format', { length: 20 }).default('json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('reports_test_run_id_idx').on(table.testRunId)]
);

// ─── API Keys ─────────────────────────────────────────────────────────────
// Used by /api/keys for personal access tokens. Schema mirrors what the
// handler already writes/reads. keyHash is sha256(key) — unique so an
// authenticated request can resolve the key to its owner in one lookup.

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    lastUsed: timestamp('last_used', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('api_keys_key_hash_idx').on(table.keyHash),
    index('api_keys_user_id_idx').on(table.userId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  testRuns: many(testRuns),
  apiKeys: many(apiKeys),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  testRuns: many(testRuns),
}));

export const testRunsRelations = relations(testRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [testRuns.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [testRuns.userId],
    references: [users.id],
  }),
  results: many(testResults),
  findings: many(findings),
  reports: many(reports),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  owner: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const testResultsRelations = relations(testResults, ({ one }) => ({
  testRun: one(testRuns, {
    fields: [testResults.testRunId],
    references: [testRuns.id],
  }),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  testRun: one(testRuns, {
    fields: [findings.testRunId],
    references: [testRuns.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  testRun: one(testRuns, {
    fields: [reports.testRunId],
    references: [testRuns.id],
  }),
}));

// ─── Enterprise Tasks (internal task tracking) ──────────────────────────

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'blocked',
]);

export const taskCategoryEnum = pgEnum('task_category', [
  'auth',
  'analyzers',
  'dashboard',
  'pipeline',
  'reports',
  'infrastructure',
  'npm_package',
  'ui_ux',
  'docs',
  'enterprise',
]);

export const enterpriseTasks = pgTable(
  'enterprise_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    category: taskCategoryEnum('category').notNull(),
    priority: varchar('priority', { length: 20 }).notNull().default('medium'),
    status: taskStatusEnum('status').notNull().default('pending'),
    stage: integer('stage').default(1),
    parentId: uuid('parent_id'),
    assignee: varchar('assignee', { length: 100 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('enterprise_tasks_status_idx').on(table.status),
    index('enterprise_tasks_category_idx').on(table.category),
    index('enterprise_tasks_stage_idx').on(table.stage),
  ]
);
