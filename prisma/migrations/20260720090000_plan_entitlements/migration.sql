ALTER TABLE "PlanConfig" ADD COLUMN "entitlements" TEXT NOT NULL DEFAULT '[]';

UPDATE "PlanConfig" SET "entitlements"='["dashboard","profile","support","community","courses"]' WHERE "slug"='starter';
UPDATE "PlanConfig" SET "entitlements"='["dashboard","profile","support","community","courses","strategies"]' WHERE "slug"='member';
UPDATE "PlanConfig" SET "entitlements"='["dashboard","profile","support","community","courses","strategies","vipStrategies","prioritySupport","reports"]' WHERE "slug"='vip';
