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

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    repoUrl: text('repo_url'),
    localPath: text('local_path').notNull(),
    branch: varchar('branch', { length: 100 }).default('main').notNull(),
    techStack: jsonb('tech_stack').default([]).$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('projects_name_idx').on(table.name),
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
    testsRun: integer('tests_run').default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_github_id_idx').on(table.githubId),
    index('users_email_idx').on(table.email),
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

// ─── Relations ────────────────────────────────────────────────────────────

export const projectsRelations = relations(projects, ({ many }) => ({
  testRuns: many(testRuns),
}));

export const testRunsRelations = relations(testRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [testRuns.projectId],
    references: [projects.id],
  }),
  results: many(testResults),
  findings: many(findings),
  reports: many(reports),
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
