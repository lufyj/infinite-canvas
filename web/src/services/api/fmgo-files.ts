import axios from "axios";

import i18n from "@/i18n";
import { getMediaBlob } from "@/services/file-storage";
import { getImageBlob } from "@/services/image-storage";
import { buildApiUrl, type AiConfig } from "@/stores/use-config-store";

type FmgoFileKind = "image" | "video" | "audio";

type FmgoFileSource = {
    name?: string;
    type?: string;
    url?: string;
    dataUrl?: string;
    storageKey?: string;
};

type FmgoFileResponse = {
    url?: string;
    error?: unknown;
    message?: unknown;
    msg?: unknown;
};

const uploadedUrls = new Map<string, Promise<string>>();

export async function fmgoFileUrl(config: AiConfig, source: FmgoFileSource, kind: FmgoFileKind, options?: { signal?: AbortSignal }) {
    const publicUrl = [source.url, source.dataUrl].find((value) => /^https?:\/\//i.test(value || ""));
    if (publicUrl) return publicUrl;

    const cacheKey = source.storageKey || [source.url, source.dataUrl].find((value) => value?.startsWith("blob:"));
    if (cacheKey && uploadedUrls.has(cacheKey)) return uploadedUrls.get(cacheKey)!;

    const request = uploadFmgoFile(config, source, kind, options);
    if (cacheKey) uploadedUrls.set(cacheKey, request);
    try {
        return await request;
    } catch (error) {
        if (cacheKey) uploadedUrls.delete(cacheKey);
        throw error;
    }
}

async function uploadFmgoFile(config: AiConfig, source: FmgoFileSource, kind: FmgoFileKind, options?: { signal?: AbortSignal }) {
    try {
        const blob = await readBlob(source, options?.signal);
        if (!blob) throw new Error(i18n.t("apiErrors.localAssetReadFailed"));
        const form = new FormData();
        form.append("file", blob, source.name || fallbackName(blob, kind));
        const payload = (
            await axios.post<FmgoFileResponse>(buildApiUrl(config.baseUrl, "/files/upload"), form, {
                headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
                signal: options?.signal,
            })
        ).data;
        if (!/^https?:\/\//i.test(payload.url || "")) throw new Error(readError(payload) || i18n.t("apiErrors.fmgoInvalidReferenceUrl"));
        return payload.url!;
    } catch (error) {
        if (axios.isCancel(error) || options?.signal?.aborted) throw error;
        throw new Error(i18n.t("apiErrors.fmgoReferenceUploadFailed", { message: readError(error) || i18n.t("apiErrors.requestFailed") }));
    }
}

async function readBlob(source: FmgoFileSource, signal?: AbortSignal) {
    if (source.storageKey) {
        const blob = source.storageKey.startsWith("image:") ? await getImageBlob(source.storageKey) : await getMediaBlob(source.storageKey);
        if (blob) return blob;
    }
    const localUrl = [source.dataUrl, source.url].find((value) => /^(?:blob:|data:)/i.test(value || ""));
    if (!localUrl) return null;
    return (await fetch(localUrl, { signal })).blob();
}

function fallbackName(blob: Blob, kind: FmgoFileKind) {
    const extension = blob.type.split("/")[1]?.split(/[;+]/)[0] || (kind === "image" ? "png" : kind === "video" ? "mp4" : "mp3");
    return `reference-${kind}.${extension}`;
}

function readError(value: unknown): string {
    if (axios.isAxiosError(value)) return readError(value.response?.data || value.message);
    if (value instanceof Error) return value.message;
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const payload = value as Record<string, unknown>;
    return readError(payload.error) || readError(payload.message) || readError(payload.msg);
}
