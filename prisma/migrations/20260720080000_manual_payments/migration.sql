CREATE TABLE "PaymentMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'wallet',
  "logoUrl" TEXT NOT NULL,
  "accent" TEXT NOT NULL DEFAULT '#9bf56a',
  "accountName" TEXT,
  "accountNo" TEXT,
  "address" TEXT,
  "network" TEXT,
  "instructions" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PaymentMethod_key_key" ON "PaymentMethod"("key");
CREATE INDEX "PaymentMethod_active_sortOrder_idx" ON "PaymentMethod"("active", "sortOrder");

CREATE TABLE "ManualPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "planSlug" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "billing" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "methodId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "screenshot" TEXT NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy" TEXT,
  "reviewedAt" DATETIME,
  "adminNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ManualPayment_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentMethod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ManualPayment_status_createdAt_idx" ON "ManualPayment"("status", "createdAt");
CREATE INDEX "ManualPayment_userId_createdAt_idx" ON "ManualPayment"("userId", "createdAt");

INSERT INTO "PaymentMethod" ("id","key","name","type","logoUrl","accent","accountName","accountNo","address","network","instructions","active","sortOrder") VALUES
('pay_jazzcash','jazzcash','JazzCash','wallet','https://www.google.com/s2/favicons?domain=jazzcash.com.pk&sz=128','#f15a24','','','','','Send payment to the listed JazzCash account, then upload a receipt screenshot with transaction ID.',true,10),
('pay_easypaisa','easypaisa','EasyPaisa','wallet','https://www.google.com/s2/favicons?domain=easypaisa.com.pk&sz=128','#78be20','','','','','Send payment to the listed EasyPaisa account, then upload a receipt screenshot with transaction ID.',true,20),
('pay_sadapay','sadapay','SadaPay','wallet','https://www.google.com/s2/favicons?domain=sadapay.pk&sz=128','#ff5f45','','','','','Send payment to the listed SadaPay account and submit the transaction proof.',true,30),
('pay_nayapay','nayapay','NayaPay','wallet','https://www.google.com/s2/favicons?domain=nayapay.com&sz=128','#05b8a5','','','','','Send payment to the listed NayaPay account and submit the transaction proof.',true,40),
('pay_usdt_bnb','usdt-bnb','USDT on BNB Chain','crypto','https://cdn.simpleicons.org/tether/26A17B','#f3ba2f','','','','BNB Smart Chain / BEP20','Send exact USDT amount on BNB Smart Chain. Paste transaction hash and upload wallet screenshot.',true,50),
('pay_usdt_aptos','usdt-aptos','USDT on Aptos','crypto','https://cdn.simpleicons.org/aptos/FFFFFF','#7c5cff','','','','Aptos','Send exact USDT amount on Aptos. Paste transaction hash and upload wallet screenshot.',true,60);
