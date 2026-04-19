import { WaterSample } from "@/types";
import { apiClient } from "./apiClient";
import { sampleService } from "./sampleService";

// Backend upload remains intentionally unconfigured in this phase.
export const syncService = {
  async uploadSample(sample: WaterSample): Promise<WaterSample> {
    console.log("[syncService] upload skipped, backend not configured", sample.id);
    await sampleService.update(sample.id, { uploadStatus: "uploading" });
    const res = await apiClient.post("/ingest/sample", sample);
    const nextStatus = res.ok ? "pending" : "failed";
    const updated = await sampleService.update(sample.id, {
      uploadStatus: nextStatus,
    });
    return updated ?? sample;
  },

  async retryAllFailed(): Promise<number> {
    const list = await sampleService.list();
    const failed = list.filter(
      (s) => s.uploadStatus === "failed" || s.uploadStatus === "pending"
    );
    for (const s of failed) {
      await this.uploadSample(s);
    }
    return failed.length;
  },
};
