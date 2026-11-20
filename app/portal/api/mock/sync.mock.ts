import type { DataSyncData, SyncRun } from "../types";

export const MOCK_SYNC_RUNS: SyncRun[] = [
  { id: "run3", finishedAt: "2026-10-12T12:20:00.000Z", products: 17, tokens: 530, failed: 0, costUsd: 0.000069, tookSeconds: 2 },
  { id: "run2", finishedAt: "2026-10-12T09:23:00.000Z", products: 17, tokens: 530, failed: 0, costUsd: 0.000069, tookSeconds: 2 },
  { id: "run1", finishedAt: "2026-10-12T06:33:00.000Z", products: 17, tokens: 530, failed: 0, costUsd: 0.000069, tookSeconds: 3 },
];

export function mockDataSync(): DataSyncData {
  return {
    productsIndexed: 17,
    fieldsRegistered: 12,
    registeredAt: "2026-10-12T06:30:00.000Z",
    // Same names the catalogue sync registers (app/portal/bigcommerce/catalogue.server.ts).
    fieldNames: [
      "id",
      "name",
      "description",
      "brand",
      "category",
      "tags",
      "price",
      "sale_price",
      "in_stock",
      "sku",
      "url",
      "primary_image",
    ],
    lastSyncAt: MOCK_SYNC_RUNS[0].finishedAt,
    runsThisMonth: MOCK_SYNC_RUNS.length,
    runs: MOCK_SYNC_RUNS,
    liveSync: { active: false },
  };
}
