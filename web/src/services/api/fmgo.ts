import axios from "axios";

import i18n from "@/i18n";
import { buildApiUrl, type AiConfig } from "@/stores/use-config-store";

export type FmgoPayload = {
    id?: string;
    task_id?: string;
    status?: string;
    status_url?: string;
    poll_after_ms?: number;
    task?: { id?: string; status?: string; status_url?: string; poll_after_ms?: number };
    result?: unknown;
    data?: unknown;
    choices?: unknown;
    result_url?: string;
    url?: string;
    error?: unknown;
    message?: unknown;
    msg?: unknown;
};

export type FmgoTask = { id: string; statusUrl?: string; pollAfterMs?: number };

export async function createFmgoTask(config: AiConfig, path: string, data: unknown, options?: { signal?: AbortSignal }, headers?: Record<string, string>) {
    const response = await axios.post<FmgoPayload>(fmgoUrl(config, path), data, { headers: { Authorization: `Bearer ${config.apiKey}`, ...headers }, signal: options?.signal });
    const payload = response.data;
    const id = payload.id || payload.task_id || payload.task?.id;
    if (!id) throw new Error(readFmgoError(payload) || i18n.t("apiErrors.fmgoNoTaskId"));
    return { id, statusUrl: payload.task?.status_url || payload.status_url, pollAfterMs: payload.poll_after_ms || payload.task?.poll_after_ms } satisfies FmgoTask;
}

export async function waitForFmgoTask(config: AiConfig, task: FmgoTask, options?: { signal?: AbortSignal }) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
        const url = task.statusUrl || fmgoUrl(config, `/tasks/${encodeURIComponent(task.id)}`);
        const payload = (await axios.get<FmgoPayload>(url, { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: options?.signal })).data;
        const status = payload.status || payload.task?.status;
        if (["completed", "succeeded", "success"].includes(status || "")) return payload;
        if (["failed", "cancelled", "canceled", "expired", "error"].includes(status || "")) throw new Error(readFmgoError(payload) || i18n.t("apiErrors.fmgoTaskFailed"));
        await delay(payload.poll_after_ms || payload.task?.poll_after_ms || task.pollAfterMs || 2000, options?.signal);
    }
    throw new Error(i18n.t("apiErrors.fmgoTaskTimeout"));
}

export function readFmgoError(value: unknown): string {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const payload = value as Record<string, unknown>;
    return readFmgoError(payload.error) || readFmgoError(payload.message) || readFmgoError(payload.msg);
}

function fmgoUrl(config: AiConfig, path: string) {
    return /^https?:/i.test(path) ? path : buildApiUrl(config.baseUrl, path);
}

function delay(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
}
