import { dataUrlToFile } from "@/lib/image-utils";
import { fmgoImageProfile, fmgoRatio } from "@/lib/fmgo-models";
import { createFmgoTask, waitForFmgoTask, type FmgoPayload } from "@/services/api/fmgo";
import { imageToDataUrl } from "@/services/image-storage";
import i18n from "@/i18n";
import { availableRequestModels, type AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";

export async function requestFmgoImages(config: AiConfig, prompt: string, references: ReferenceImage[] = [], options?: { signal?: AbortSignal }) {
    const model = config.model || config.imageModel;
    const profile = fmgoImageProfile(model, config.quality, availableRequestModels(config, model));
    if (!profile) throw new Error(i18n.t("apiErrors.fmgoUnsupportedImageModel", { model: config.model || config.imageModel }));
    const ratio = fmgoRatio(config.size, profile.ratios, profile.defaultRatio);
    const task = profile.family === "gpt"
        ? await createGptTask(config, profile, ratio, prompt, references, options)
        : await createGeminiTask(config, profile, ratio, prompt, references, options);
    const payload = await waitForFmgoTask(config, task, options);
    const urls = findImageUrls(payload);
    if (!urls.length) throw new Error(i18n.t("apiErrors.fmgoNoImage"));
    return urls;
}

async function createGptTask(config: AiConfig, profile: NonNullable<ReturnType<typeof fmgoImageProfile>>, ratio: string, prompt: string, references: ReferenceImage[], options?: { signal?: AbortSignal }) {
    const requestPrompt = prompt.trim().startsWith(`比例${ratio}`) ? prompt : `比例${ratio}, ${prompt}`;
    const imageSize = profile.imageSize.toLowerCase();
    if (!references.length) {
        return createFmgoTask(config, "/images/generations", { model: profile.requestModel, prompt: requestPrompt, aspect_ratio: ratio, ...(profile.requestModel === "gpt-image-2" ? {} : { image_size: imageSize }) }, options, { "Content-Type": "application/json", Accept: "application/json", Prefer: "respond-async", "X-Flow-Async": "1" });
    }
    const body = new FormData();
    body.set("model", profile.requestModel);
    body.set("prompt", requestPrompt);
    body.set("aspect_ratio", ratio);
    if (profile.requestModel !== "gpt-image-2") body.set("image_size", imageSize);
    const files = await Promise.all(references.map(async (image) => dataUrlToFile({ ...image, dataUrl: await imageToDataUrl(image) })));
    files.forEach((file) => body.append("image", file));
    return createFmgoTask(config, "/images/edits", body, options, { Accept: "application/json", Prefer: "respond-async", "X-Flow-Async": "1" });
}

async function createGeminiTask(config: AiConfig, profile: NonNullable<ReturnType<typeof fmgoImageProfile>>, ratio: string, prompt: string, references: ReferenceImage[], options?: { signal?: AbortSignal }) {
    const images = await Promise.all(references.map(fmgoChatImageReference));
    const content = images.length ? [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] : prompt;
    return createFmgoTask(config, "/chat/completions", { model: profile.requestModel, messages: [{ role: "user", content }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ratio, imageSize: profile.imageSize } }, stream: false }, options, { "Content-Type": "application/json", Accept: "application/json", Prefer: "respond-async", "X-Flow-Async": "1" });
}

async function fmgoChatImageReference(image: ReferenceImage) {
    const publicUrl = [image.url, image.dataUrl].find((value) => /^https?:\/\//i.test(value || ""));
    if (publicUrl) return publicUrl;
    try {
        return await imageToDataUrl(image);
    } catch (error) {
        throw new Error(i18n.t("apiErrors.referenceImageReadFailed"), { cause: error });
    }
}

function findImageUrls(payload: FmgoPayload) {
    const urls = new Set<string>();
    collect(payload.result, urls, typeof payload.result === "string");
    collect(payload.data, urls, typeof payload.data === "string");
    collect(payload.choices, urls);
    collect(payload.url, urls);
    collect(payload.result_url, urls);
    return [...urls];
}

function collect(value: unknown, urls: Set<string>, rawBase64 = false) {
    if (typeof value === "string") {
        value.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s"'<>]+/g)?.forEach((url) => urls.add(url));
        if (rawBase64 && /^[A-Za-z0-9+/=\s]{128,}$/.test(value)) urls.add(`data:image/png;base64,${value.replace(/\s/g, "")}`);
    } else if (Array.isArray(value)) value.forEach((item) => collect(item, urls, rawBase64));
    else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, item]) => {
            if (["b64_json", "image_base64", "base64"].includes(key) || (key === "data" && ("mimeType" in value || "mime_type" in value))) {
                if (typeof item === "string" && /^[A-Za-z0-9+/=\s]{128,}$/.test(item)) urls.add(`data:image/png;base64,${item.replace(/\s/g, "")}`);
                else collect(item, urls, true);
                return;
            }
            collect(item, urls);
        });
    }
}
