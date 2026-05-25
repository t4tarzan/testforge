CREATE TYPE "public"."finding_status" AS ENUM('open', 'fixed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."task_category" AS ENUM('auth', 'analyzers', 'dashboard', 'pipeline', 'reports', 'infrastructure', 'npm_package', 'ui_ux', 'docs', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."test_result_status" AS ENUM('passed', 'failed', 'warning', 'pending');--> statement-breakpoint
CREATE TYPE "public"."test_run_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"last_used" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enterprise_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" "task_category" NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"stage" integer DEFAULT 1,
	"parent_id" uuid,
	"assignee" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"dimension" varchar(50) NOT NULL,
	"severity" "severity",
	"title" text NOT NULL,
	"description" text,
	"file_path" text,
	"line_number" integer,
	"cve_id" varchar(50),
	"exploitability" text,
	"fix_suggestion" text,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"stripe_customer_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"repo_url" text,
	"local_path" text NOT NULL,
	"branch" varchar(100) DEFAULT 'main' NOT NULL,
	"tech_stack" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"format" varchar(20) DEFAULT 'json' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_run_id" uuid NOT NULL,
	"dimension" varchar(50) NOT NULL,
	"dimension_label" varchar(100),
	"status" "test_result_status",
	"duration_ms" integer,
	"metrics" jsonb,
	"logs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"branch" varchar(100) NOT NULL,
	"commit_hash" varchar(40),
	"status" "test_run_status" NOT NULL,
	"overall_score" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"config" jsonb DEFAULT '{}'::jsonb,
	"total_findings" integer DEFAULT 0 NOT NULL,
	"critical_count" integer DEFAULT 0 NOT NULL,
	"high_count" integer DEFAULT 0 NOT NULL,
	"medium_count" integer DEFAULT 0 NOT NULL,
	"low_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"avatar_url" text,
	"login" varchar(100) NOT NULL,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"tests_run" integer DEFAULT 0,
	"last_login_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enterprise_tasks_status_idx" ON "enterprise_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enterprise_tasks_category_idx" ON "enterprise_tasks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "enterprise_tasks_stage_idx" ON "enterprise_tasks" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "findings_test_run_id_idx" ON "findings" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "findings_dimension_idx" ON "findings" USING btree ("dimension");--> statement-breakpoint
CREATE INDEX "findings_severity_idx" ON "findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "findings_status_idx" ON "findings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_idx" ON "memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_name_idx" ON "projects" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_repo_url_idx" ON "projects" USING btree ("repo_url");--> statement-breakpoint
CREATE INDEX "reports_test_run_id_idx" ON "reports" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "test_results_test_run_id_idx" ON "test_results" USING btree ("test_run_id");--> statement-breakpoint
CREATE INDEX "test_results_dimension_idx" ON "test_results" USING btree ("dimension");--> statement-breakpoint
CREATE INDEX "test_runs_project_id_idx" ON "test_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_runs_user_id_idx" ON "test_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "test_runs_status_idx" ON "test_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "test_runs_branch_idx" ON "test_runs" USING btree ("branch");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_id_idx" ON "users" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");