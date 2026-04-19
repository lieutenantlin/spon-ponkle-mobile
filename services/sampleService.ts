import AsyncStorage from "@react-native-async-storage/async-storage";
import { WaterSample } from "@/types";

const KEY = "mp_samples_v1";

async function readAll(): Promise<WaterSample[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    return (JSON.parse(raw) as WaterSample[]).map(normalizeStoredSample);
  } catch (e) {
    console.log("[sampleService] readAll error", e);
    return [];
  }
}

async function writeAll(list: WaterSample[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

// TODO: back with real GET /samples, GET /samples/:id, POST /ingest/sample
export const sampleService = {
  async list(): Promise<WaterSample[]> {
    const list = await readAll();
    return list.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  },

  async get(id: string): Promise<WaterSample | null> {
    const list = await readAll();
    return list.find((s) => s.id === id) ?? null;
  },

  async create(sample: WaterSample): Promise<WaterSample> {
    const list = await readAll();
    const next = [sample, ...list];
    await writeAll(next);
    return sample;
  },

  async update(id: string, patch: Partial<WaterSample>): Promise<WaterSample | null> {
    const list = await readAll();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const updated = { ...list[idx], ...patch };
    list[idx] = updated;
    await writeAll(list);
    return updated;
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};

function normalizeStoredSample(sample: WaterSample): WaterSample {
  return {
    ...sample,
    inferenceStatus:
      sample.inferenceStatus ??
      (sample.microplasticEstimate !== undefined ? "mocked" : "pending"),
  };
}
