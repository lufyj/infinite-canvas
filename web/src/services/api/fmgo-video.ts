import axios from "axios";

import i18n from "@/i18n";
import { fmgoVideoSelection } from "@/lib/fmgo-models";
import { imageToDataUrl } from "@/services/image-storage";
import { availableRequestModels, buildApiUrl, modelOptionName, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { VideoGenerationResult, VideoGenerationTask, VideoGenerationTaskState } from "@/services/api/video";

type FmgoVideoPayload = {
    id?: string;
    task_id?: string;
    status?: string;
    status_url?: string;
    poll_after_ms?: number;
    progress?: number;
    task?: { id?: string; status?: string; status_url?: string; poll_after_ms?: number };
    result?: unknown;
    result_url?: string;
    url?: string;
    video_url?: string;
    error?: unknown;
    message?: unknown;
    msg?: unknown;
};

export type FmgoVideoTask = VideoGenerationTask & { provider: "fmgo"; endpoint: "chat" | "videos"; statusUrl?: string; pollAfterMs?: number };
const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);

export async function createFmgoVideoTask(config: AiConfig, model: string, prompt: string, references: ReferenceImage[], options?: { signal?: AbortSignal; referenceVideos?: Array<{ url?: string; storageKey?: string }>; referenceAudios?: Array<{ url?: string; storageKey?: string }> }): Promise<FmgoVideoTask> {
    if (!prompt.trim()) throw new Error(apiText("videoPromptRequired"));
    if (!config.baseUrl.trim()) throw new Error(apiText("baseUrlRequired"));
    if (!config.apiKey.trim()) throw new Error(apiText("apiKeyRequired"));
    const requestModel = modelOptionName(model);
    const profile = fmgoVideoSelection(requestModel, config.vquality, config.videoSeconds, config.size, availableRequestModels(config, model));
    if (!profile) throw new Error(`FMGO 不支持视频模型 ${requestModel}`);
    const endpoint = profile.endpoint;
    const maxReferences = profile.maxReferences;
    const images = await Promise.all(references.slice(0, maxReferences).map(fmgoImageReference));
    if (profile.model === "grok-1.5" && !images.length) throw new Error("FMGO grok-1.5 仅支持首帧或单图参考生成");
    const allowMediaDataUrl = profile.model === "feimiao-v2-431" || profile.model === "feimiao-v2.5";
    const videoUrls = (options?.referenceVideos || []).map((media) => mediaUrl(media, allowMediaDataUrl)).filter((url): url is string => Boolean(url));
    const audioUrls = (options?.referenceAudios || []).map((media) => mediaUrl(media, allowMediaDataUrl)).filter((url): url is string => Boolean(url));
    if ((options?.referenceVideos || []).some((media) => !mediaUrl(media, allowMediaDataUrl))) throw new Error(apiText("invalidReferenceVideo"));
    if ((options?.referenceAudios || []).some((media) => !mediaUrl(media, allowMediaDataUrl))) throw new Error(apiText("invalidReferenceAudio"));
    if (["feimiao-v2-431", "feimiao-v2.5"].includes(profile.model) && audioUrls.length && !images.length && !videoUrls.length) throw new Error(apiText("invalidReferenceAudio"));
    if (profile.endpoint === "chat" && images.length + videoUrls.length + audioUrls.length > maxReferences) throw new Error(`FMGO ${profile.model} supports at most ${maxReferences} references`);
    if ((videoUrls.length || audioUrls.length) && !["feimiao-v2", "feimiao-v2-fast", "feimiao-v2-431", "feimiao-v2.5"].includes(profile.model)) throw new Error(`FMGO ${profile.model} does not support video or audio references`);
    const { resolution, seconds, ratio } = profile;
    const headers = { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json", ...(endpoint === "chat" ? { Prefer: "respond-async" } : {}) };
    const body = endpoint === "chat"
        ? {
              model: profile.requestModel,
              messages: [{ role: "user", content: images.length || videoUrls.length || audioUrls.length ? [{ type: "text", text: prompt }, ...[...images, ...videoUrls, ...audioUrls].slice(0, 9).map((url) => ({ type: "image_url", image_url: { url } }))] : prompt }],
              generationConfig: { videoConfig: { duration: Number(seconds), aspectRatio: ratio, ...(profile.resolutions.length ? { resolution } : {}) } },
              ...(images.length + videoUrls.length + audioUrls.length > 1 && (profile.model === "veo-3.1" || profile.model === "feimiao-v2" || profile.model === "feimiao-v2-fast") ? { reference_mode: "image" } : {}),
              async: true,
          }
          : videoBody(profile.model, profile.requestModel, prompt, ratio, resolution, seconds, images, videoUrls, audioUrls, maxReferences, config.videoGenerateAudio !== "false");
    try {
        const payload = (await axios.post<FmgoVideoPayload>(buildApiUrl(config.baseUrl, endpoint === "chat" ? "/chat/completions" : "/videos"), body, { headers, signal: options?.signal })).data;
        const id = payload.id || payload.task_id || payload.task?.id;
        if (!id) throw new Error(readError(payload) || apiText("noVideoTaskId"));
        return { id, provider: "fmgo", model, endpoint, statusUrl: payload.task?.status_url || payload.status_url, pollAfterMs: payload.poll_after_ms || payload.task?.poll_after_ms };
    } catch (error) {
        if (axios.isCancel(error) || options?.signal?.aborted) throw error;
        throw new Error(readError(error) || apiText("videoTaskCreateFailed"));
    }
}

export async function pollFmgoVideoTask(config: AiConfig, task: FmgoVideoTask, options?: { signal?: AbortSignal }): Promise<VideoGenerationTaskState> {
    const url = task.statusUrl || buildApiUrl(config.baseUrl, task.endpoint === "videos" ? `/videos/${encodeURIComponent(task.id)}` : `/tasks/${encodeURIComponent(task.id)}`);
    try {
        const payload = (await axios.get<FmgoVideoPayload>(url, { headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" }, signal: options?.signal })).data;
        const status = String(payload.status || payload.task?.status || "").toLowerCase();
        if (!status) return { status: "failed", error: apiText("videoTaskQueryFailed") };
        if (["failed", "cancelled", "canceled", "expired", "error"].includes(status)) return { status: "failed", error: readError(payload) || apiText("videoGenerationFailed") };
        const resultUrl = findVideoUrl(payload);
        if (["completed", "succeeded", "success"].includes(status) && resultUrl) return { status: "completed", result: await videoResultFromUrl(resultUrl, options) };
        if (["completed", "succeeded", "success"].includes(status)) return { status: "failed", error: apiText("noPlayableVideo") };
        return { status: "pending" };
    } catch (error) {
        if (axios.isCancel(error) || options?.signal?.aborted) throw error;
        throw new Error(readError(error) || apiText("videoTaskQueryFailed"));
    }
}

async function fmgoImageReference(image: ReferenceImage) {
    const publicUrl = [image.url, image.dataUrl].find((value) => /^https?:\/\//i.test(value || ""));
    if (publicUrl) return publicUrl;
    try {
        return await imageToDataUrl(image);
    } catch (error) {
        throw new Error(apiText("referenceImageReadFailed"), { cause: error });
    }
}

function videoBody(model: string, requestModel: string, prompt: string, ratio: string, resolution: string, seconds: string, images: string[], videoUrls: string[], audioUrls: string[], maxReferences: number, motionHasAudio: boolean) {
    if (model === "grok-1.5" || model === "grok-1.5-fast") {
        return {
            model: requestModel,
            prompt,
            ratio,
            resolution,
            duration: Number(seconds),
            ...(images.length ? { reference_images: images.slice(0, 1) } : {}),
        };
    }
    return {
        model: requestModel,
        prompt,
        aspect_ratio: ratio,
        ratio,
        resolution,
        seconds,
        ...(["feimiao-v2-431", "feimiao-v2.5"].includes(model) ? { motion_has_audio: motionHasAudio } : {}),
        ...(images.length ? { images: images.slice(0, maxReferences) } : {}),
        ...(["feimiao-v2-431", "feimiao-v2.5"].includes(model) && videoUrls.length ? { reference_videos: videoUrls.slice(0, 3) } : {}),
        ...(["feimiao-v2-431", "feimiao-v2.5"].includes(model) && audioUrls.length ? { reference_audios: audioUrls.slice(0, 3) } : {}),
    };
}

function findVideoUrl(payload: FmgoVideoPayload): string | undefined {
    const candidates = [payload.result_url, payload.video_url, payload.url, payload.result];
    for (const candidate of candidates) {
        const url = collectUrl(candidate);
        if (url) return url;
    }
    return undefined;
}

function collectUrl(value: unknown): string | undefined {
    if (typeof value === "string") return value.match(/https?:\/\/[^\s"'<>\)]+/)?.[0];
    if (Array.isArray(value)) return value.map(collectUrl).find(Boolean);
    if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).filter(([key]) => !["status_url", "statusUrl", "poll_after_ms", "task", "id"].includes(key)).map(([, item]) => collectUrl(item)).find(Boolean);
    return undefined;
}

function mediaUrl(value: { url?: string; storageKey?: string }, allowDataUrl = false) {
    const url = value.url || value.storageKey || "";
    return /^(?:https?:\/\/|data:(?:video|audio)\/)/i.test(url) && (allowDataUrl || !url.startsWith("data:")) ? url : "";
}

async function videoResultFromUrl(url: string, options?: { signal?: AbortSignal }): Promise<VideoGenerationResult> {
    try {
        const response = await axios.get<Blob>(url, { responseType: "blob", signal: options?.signal });
        if (response.data.type.includes("json")) throw new Error(apiText("videoDownloadFailed"));
        return { blob: response.data, mimeType: response.data.type || "video/mp4" };
    } catch (error) {
        if (axios.isCancel(error) || options?.signal?.aborted) throw error;
        return { url, mimeType: "video/mp4" };
    }
}

function readError(value: unknown): string {
    if (axios.isAxiosError(value)) return readError(value.response?.data || value.message);
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const payload = value as Record<string, unknown>;
    return readError(payload.error) || readError(payload.message) || readError(payload.msg);
}
