import { expect, it } from "vitest";
import { LicenseSdk } from "@t2e/license-sdk";
import { MemorySdkStorage } from "@t2e/license-sdk/testing";
import { createHash, createPublicKey, randomUUID, verify } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recoverExport } from "../../packages/core/src/receipts";

it.each(["initial-temporary", "primary-running", "prepared-temporary"])(
  "reconciles %s after restart through the installed SDK's signed trial protocol",
  async (kind) => {
    const root = await mkdtemp(join(tmpdir(), "precut-trial-recovery-")),
      projectId = randomUUID(),
      operationId = randomUUID(),
      trialId = randomUUID(),
      folder = join(root, projectId, "export-cache"),
      storage = new MemorySdkStorage();
    let reserved = 1,
      used = 0;
    const actions: string[] = [];
    const challenges = new Map<
      string,
      {
        canonicalPayload: string;
        publicKey: string;
        action: string;
        operationId?: string;
        feature?: string;
      }
    >();
    const sdk = new LicenseSdk({
      baseUrl: "https://licence.precut.test",
      productCode: "PC",
      storage,
      machineIdentity: async () => "stable-test-machine",
      recoverOperation: (operation) =>
        recoverExport(
          root,
          operation.operationId,
          operation.recovery!.projectId,
        ),
      fetch: async (url, init) => {
        const body = JSON.parse(String(init?.body));
        const reply = (data: unknown) =>
          new Response(JSON.stringify({ data }), {
            headers: { "content-type": "application/json" },
          });
        if (String(url).endsWith("/challenges")) {
          const challengeId = randomUUID();
          const canonicalPayload = JSON.stringify({
            version: 1,
            challengeId,
            action: body.action,
            productCode: body.productCode,
            fingerprint: body.fingerprint,
            deviceKeyThumbprint: createHash("sha256")
              .update(
                createPublicKey(body.devicePublicKey).export({
                  type: "spki",
                  format: "der",
                }),
              )
              .digest("base64url"),
            nonce: "a".repeat(43),
            feature: body.feature ?? null,
            operationId: body.operationId ?? null,
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
          });
          challenges.set(challengeId, {
            canonicalPayload,
            publicKey: body.devicePublicKey,
            action: body.action,
            operationId: body.operationId,
            feature: body.feature,
          });
          return reply({ challengeId, canonicalPayload });
        }
        const challenge = challenges.get(body.challengeId)!;
        expect(
          verify(
            null,
            Buffer.from(challenge.canonicalPayload),
            challenge.publicKey,
            Buffer.from(body.signature, "base64url"),
          ),
        ).toBe(true);
        expect(String(url)).toBe(
          `https://licence.precut.test/v1/trials/${challenge.action.toLowerCase()}`,
        );
        actions.push(challenge.action);
        if (challenge.action === "RELEASE") reserved--;
        if (challenge.action === "RESERVE") reserved++;
        if (challenge.action === "COMMIT") {
          reserved--;
          used++;
        }
        return reply({
          trialId,
          enabled: true,
          features: {
            export: {
              limit: 3,
              used,
              reserved,
              remaining: 3 - used - reserved,
            },
          },
          ...(challenge.operationId
            ? {
                operation: {
                  operationId: challenge.operationId,
                  feature: challenge.feature,
                  status:
                    challenge.action === "RELEASE"
                      ? "RELEASED"
                      : challenge.action === "COMMIT"
                        ? "COMMITTED"
                        : "RESERVED",
                  replay: false,
                },
              }
            : {}),
        });
      },
    });
    try {
      await mkdir(folder, { recursive: true });
      await writeFile(
        join(
          folder,
          `${operationId}.receipt.json${kind === "primary-running" ? "" : ".tmp"}`,
        ),
        JSON.stringify({
          operationId,
          state: kind === "prepared-temporary" ? "prepared" : "running",
          artifacts: [],
          projectRevision: 1,
          sourceFingerprint: "f".repeat(64),
          format: "mp4",
          updatedAt: new Date().toISOString(),
        }),
      );
      await storage.save({
        version: 1,
        productCode: "PC",
        license: null,
        pending: [
          {
            operationId,
            feature: "export",
            state: "RUNNING",
            recovery: { projectId },
          },
        ],
      });
      const access = await sdk.getAccess();
      const unstarted = kind === "initial-temporary";
      expect(access.pendingOperations).toBe(unstarted ? 0 : 1);
      expect(access.quota.export).toMatchObject({
        used: 0,
        reserved: unstarted ? 0 : 1,
        remaining: unstarted ? 3 : 2,
      });
      expect(actions.filter((action) => action === "RELEASE")).toHaveLength(
        unstarted ? 1 : 0,
      );
      if (unstarted) {
        await expect(
          sdk.runWithAccess(
            {
              feature: "export",
              operationId: randomUUID(),
              recovery: { projectId },
            },
            async () => "rendered",
          ),
        ).resolves.toBe("rendered");
        expect(actions.filter((action) => action === "RESERVE")).toHaveLength(
          1,
        );
        expect(actions.filter((action) => action === "COMMIT")).toHaveLength(1);
        expect((await sdk.getAccess()).quota.export).toMatchObject({
          used: 1,
          reserved: 0,
          remaining: 2,
        });
      }
    } finally {
      await sdk.dispose();
      await rm(root, { recursive: true, force: true });
    }
  },
);
