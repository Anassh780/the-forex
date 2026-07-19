ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "suspendedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "suspensionReason" TEXT;

CREATE TABLE "CommunityLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "logoUrl" TEXT NOT NULL,
  "accent" TEXT NOT NULL DEFAULT '#9bf56a',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityLink_key_key" ON "CommunityLink"("key");
CREATE INDEX "CommunityLink_category_sortOrder_idx" ON "CommunityLink"("category", "sortOrder");

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "message" TEXT NOT NULL,
  "attachments" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" DATETIME,
  CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt");

CREATE TABLE "PlanConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "monthlyPrice" REAL NOT NULL,
  "annualPrice" REAL NOT NULL,
  "monthlyStripePriceId" TEXT,
  "annualStripePriceId" TEXT,
  "features" TEXT NOT NULL,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PlanConfig_slug_key" ON "PlanConfig"("slug");

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountPercent" INTEGER NOT NULL,
  "appliesTo" TEXT NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" DATETIME,
  "endsAt" DATETIME,
  "maxRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "fileId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "details" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SecurityEvent_status_severity_createdAt_idx" ON "SecurityEvent"("status", "severity", "createdAt");
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");

CREATE TABLE "VideoAccessLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "ip" TEXT,
  "range" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VideoAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VideoAccessLog_userId_createdAt_idx" ON "VideoAccessLog"("userId", "createdAt");
CREATE INDEX "VideoAccessLog_userId_fileId_createdAt_idx" ON "VideoAccessLog"("userId", "fileId", "createdAt");

INSERT INTO "CommunityLink" ("id","key","name","category","description","url","logoUrl","accent","sortOrder") VALUES
('community_tiktok','tiktok','TikTok','social','Short trading education, platform clips, and community highlights.','https://www.tiktok.com/','https://cdn.simpleicons.org/tiktok/FFFFFF','#ffffff',10),
('community_whatsapp','whatsapp','WhatsApp','social','Join announcements and member conversation through the official channel.','https://www.whatsapp.com/','https://cdn.simpleicons.org/whatsapp/25D366','#25D366',20),
('community_youtube','youtube','YouTube','social','Long-form lessons, market breakdowns, and product walkthroughs.','https://www.youtube.com/','https://cdn.simpleicons.org/youtube/FF0000','#FF0000',30),
('community_instagram','instagram','Instagram','social','Charts, education snippets, and EdgeLedger community updates.','https://www.instagram.com/','https://cdn.simpleicons.org/instagram/E4405F','#E4405F',40),
('community_xm','xm','XM','broker','External broker destination. Review eligibility, regulation, and risk terms for your region.','https://www.xm.com/','https://www.google.com/s2/favicons?domain=xm.com&sz=128','#ea1c24',50),
('community_hfm','hfm','HFM','broker','External broker destination with account and platform information.','https://www.hfm.com/','https://www.google.com/s2/favicons?domain=hfm.com&sz=128','#e21b2d',60),
('community_exness','exness','Exness','broker','External multi-asset broker destination; regional availability and terms apply.','https://www.exness.com/','https://www.google.com/s2/favicons?domain=exness.com&sz=128','#ffde02',70),
('community_justmarkets','justmarkets','JustMarkets','broker','External broker destination for trading account and platform details.','https://justmarkets.com/','https://www.google.com/s2/favicons?domain=justmarkets.com&sz=128','#1d7cff',80);

INSERT INTO "PlanConfig" ("id","slug","name","tagline","monthlyPrice","annualPrice","features","featured","active","trialDays","sortOrder") VALUES
('plan_starter','starter','Starter','Build your foundation with the public EdgeLedger workspace.',0,0,'["Community hub and official links","Help center and support tickets","Course catalog browsing","Personal profile and live dashboard","Product feedback with media"]',false,true,0,10),
('plan_member','member','Member','Unlock the complete learning and verified research workspace.',39,31,'["Everything in Starter","Full secure course video library","Automatic lesson progress tracking","Verified strategy library","Saved strategy research vault","Standard support ticket queue"]',false,true,7,20),
('plan_vip','vip','VIP Pro','Priority access for traders using the full EdgeLedger desk.',99,79,'["Everything in Member","VIP-only strategy access","Priority support ticket queue","Early access to published research","Complete proof reports and trade logs","Extended community and broker resources"]',true,true,14,30);
