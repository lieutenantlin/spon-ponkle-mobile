import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useState } from "react";
import {
  DeviceCaptureSession,
  GeoLocation,
  SampleMetadataDraft,
  ScanResult,
} from "@/types";

export interface ScanDraft {
  imageUri?: string;
  imageUris?: string[];
  location?: GeoLocation;
  metadata: SampleMetadataDraft;
  result?: ScanResult;
  captureSession?: DeviceCaptureSession | null;
}

const EMPTY: ScanDraft = { metadata: {} };

export const [ScanDraftProvider, useScanDraft] = createContextHook(() => {
  const [draft, setDraft] = useState<ScanDraft>(EMPTY);

  const reset = useCallback(() => setDraft(EMPTY), []);

  const setImage = useCallback(
    (uri: string) =>
      setDraft((d) => ({
        ...d,
        imageUri: uri,
        imageUris: d.imageUris ? [...d.imageUris, uri] : [uri],
      })),
    []
  );

  const clearImages = useCallback(
    () => setDraft((d) => ({ ...d, imageUri: undefined, imageUris: undefined })),
    []
  );

  const setLocation = useCallback(
    (loc: GeoLocation | undefined) =>
      setDraft((d) => ({ ...d, location: loc })),
    []
  );

  const setMetadata = useCallback(
    (m: SampleMetadataDraft) =>
      setDraft((d) => ({ ...d, metadata: { ...d.metadata, ...m } })),
    []
  );

  const setResult = useCallback(
    (r: ScanResult | undefined) => setDraft((d) => ({ ...d, result: r })),
    []
  );

  const setCaptureSession = useCallback(
    (captureSession: DeviceCaptureSession | null | undefined) =>
      setDraft((d) => ({ ...d, captureSession: captureSession ?? null })),
    []
  );

  return {
    draft,
    reset,
    setImage,
    clearImages,
    setLocation,
    setMetadata,
    setResult,
    setCaptureSession,
  };
});
