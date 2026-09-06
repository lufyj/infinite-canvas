type FmgoImageSpec = {
    family: "gpt" | "gemini";
    imageSizes: readonly string[];
    defaultImageSize: string;
    defaultRatio: string;
    ratios: readonly string[];
};

export type FmgoVideoSpec = {
    endpoint: "chat" | "videos";
    durations: readonly number[];
    durationsByResolution?: Readonly<Record<string, readonly number[]>>;
    ratios: readonly string[];
    resolutions: readonly string[];
    defaultResolution: string;
    maxReferences: number;
    appendResolutionDuration?: boolean;
};

export const FMGO_IMAGE_MODEL_SPECS: Record<string, FmgoImageSpec> = {
    "gemini-3.0-pro-image": { family: "gemini", imageSizes: ["2K", "4K"], defaultImageSize: "2K", defaultRatio: "16:9", ratios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
    "gemini-3.1-flash-image": { family: "gemini", imageSizes: ["1K"], defaultImageSize: "1K", defaultRatio: "16:9", ratios: ["1:1", "16:9", "9:16", "4:3", "3:4"] },
    "gpt-image-2": { family: "gpt", imageSizes: ["1K", "2K", "4K"], defaultImageSize: "1K", defaultRatio: "1:1", ratios: ["1:1", "16:9", "9:16", "2:3", "3:2", "4:3", "3:4"] },
};

export const FMGO_VIDEO_MODEL_SPECS: Record<string, FmgoVideoSpec> = {
    "grok-1.5": videoSpec("videos", [10, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 1),
    "grok-1.5-fast": videoSpec("videos", [6, 10, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 1),
    "sora-2-pro": videoSpec("chat", [4, 8, 12], ["16:9", "9:16"], [], 1),
    "veo-3.1": videoSpec("chat", [4, 6, 8], ["16:9", "9:16"], ["720p", "1080p"], 3),
    omni: videoSpec("videos", [8, 10], ["16:9", "9:16"], ["720p"], 4),
    "feimiao-v2": videoSpec("chat", [6, 8, 10, 12, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 9, true),
    "feimiao-v2-fast": videoSpec("chat", [6, 8, 10, 12, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 9, true),
    "feimiao-v2-431": videoSpec("videos", [10, 15], ["16:9", "9:16", "1:1"], ["480p", "720p"], 4, true),
    "feimiao-v2.5": { ...videoSpec("videos", [5, 10, 15, 30], ["16:9", "9:16", "1:1"], ["480p", "720p"], 4, true), durationsByResolution: { "480p": [5, 10, 15, 30], "720p": [10, 15, 30] } },
    "feimiao-v2-mini": { ...videoSpec("videos", [5, 10], ["16:9", "9:16", "1:1"], ["480p", "720p"], 9, true), durationsByResolution: { "480p": [10], "720p": [5] } },
};

export const FMGO_MODEL_GROUPS = [
    { key: "gemini", models: ["gemini-3.1-flash-image", "gemini-3.0-pro-image"] },
    { key: "gptImage", models: ["gpt-image-2"] },
    { key: "grok", models: ["grok-1.5", "grok-1.5-fast"] },
    { key: "sora", models: ["sora-2-pro"] },
    { key: "veo", models: ["veo-3.1"] },
    { key: "omni", models: ["omni"] },
    { key: "feimiaoV2", models: ["feimiao-v2", "feimiao-v2-fast", "feimiao-v2-mini"] },
    { key: "feimiao431", models: ["feimiao-v2-431"] },
    { key: "feimiao25", models: ["feimiao-v2.5"] },
] as const;

export const FMGO_IMAGE_MODELS = Object.keys(FMGO_IMAGE_MODEL_SPECS);
export const FMGO_VIDEO_MODELS = Object.keys(FMGO_VIDEO_MODEL_SPECS);
export const FMGO_PLUGIN_MODELS = [...FMGO_IMAGE_MODELS, ...FMGO_VIDEO_MODELS];

export function fmgoModelCapability(model: string) {
    const name = model.split("::").at(-1)?.toLowerCase() || "";
    if (name in FMGO_IMAGE_MODEL_SPECS) return "image" as const;
    if (name in FMGO_VIDEO_MODEL_SPECS) return "video" as const;
    return undefined;
}

export function fmgoLogicalModelName(model: string) {
    const name = model.trim();
    const lowerName = name.toLowerCase();
    if (lowerName in FMGO_IMAGE_MODEL_SPECS || lowerName in FMGO_VIDEO_MODEL_SPECS) return lowerName;
    if (lowerName === "gpt-image-2-plus" || lowerName === "gpt-image-2-pro") return "gpt-image-2";
    if (/^gemini-3\.0-pro-image-(2k|4k)$/i.test(name)) return "gemini-3.0-pro-image";
    if (/^grok-video-1\.5-\d+s$/i.test(name)) return "grok-1.5";
    if (/^grok-video-\d+s$/i.test(name)) return "grok-1.5-fast";
    if (lowerName === "gemini-omni-flash") return "omni";
    const dynamicVideoModel = Object.entries(FMGO_VIDEO_MODEL_SPECS).find(([base, spec]) => spec.appendResolutionDuration && lowerName.startsWith(`${base}-`) && /^(480p|720p)-\d+s$/i.test(lowerName.slice(base.length + 1)));
    return dynamicVideoModel?.[0] || name;
}

export function fmgoImageProfile(model: string, quality = "", availableRequestModels?: readonly string[]) {
    const name = model.split("::").at(-1)?.toLowerCase() || "";
    const spec = FMGO_IMAGE_MODEL_SPECS[name];
    if (!spec) return null;
    const available = availableRequestModels ? new Set(availableRequestModels.map((item) => item.toLowerCase())) : null;
    const imageSizes = spec.imageSizes.filter((size) => !available || available.has(imageRequestModel(name, size)));
    if (!imageSizes.length) return null;
    const requestedSize = quality.trim().toUpperCase();
    const imageSize = imageSizes.includes(requestedSize) ? requestedSize : imageSizes.includes(spec.defaultImageSize) ? spec.defaultImageSize : imageSizes[0];
    return { ...spec, imageSizes, model: name, requestModel: imageRequestModel(name, imageSize), imageSize };
}

export function fmgoVideoSelection(model: string, resolutionValue = "", durationValue = "", ratioValue = "", availableRequestModels?: readonly string[]) {
    const name = model.split("::").at(-1)?.toLowerCase() || "";
    const spec = FMGO_VIDEO_MODEL_SPECS[name];
    if (!spec) return null;
    const available = availableRequestModels ? new Set(availableRequestModels.map((item) => item.toLowerCase())) : null;
    const allows = (resolution: string, seconds: number) => !available || available.has(videoRequestModel(name, resolution, seconds));
    const resolutions = spec.resolutions.filter((resolution) => (spec.durationsByResolution?.[resolution] || spec.durations).some((seconds) => allows(resolution, seconds)));
    if (spec.resolutions.length && !resolutions.length) return null;
    const requestedResolution = resolutionValue.trim().toLowerCase().replace(/^(480|720|1080)$/, "$1p");
    const resolution = resolutions.includes(requestedResolution) ? requestedResolution : resolutions.includes(spec.defaultResolution) ? spec.defaultResolution : resolutions[0] || "";
    const durations = (spec.durationsByResolution?.[resolution] || spec.durations).filter((seconds) => allows(resolution, seconds));
    if (!durations.length) return null;
    const requestedDuration = Math.floor(Number(durationValue));
    const seconds = durations.includes(requestedDuration) ? requestedDuration : durations[0];
    const ratio = fmgoRatio(ratioValue, spec.ratios);
    return { ...spec, resolutions, model: name, requestModel: videoRequestModel(name, resolution, seconds), resolution, durations, seconds: String(seconds), ratio };
}

export function fmgoRequestModelIds(model: string) {
    const name = model.split("::").at(-1)?.toLowerCase() || "";
    const imageSpec = FMGO_IMAGE_MODEL_SPECS[name];
    if (imageSpec) return imageSpec.imageSizes.map((size) => imageRequestModel(name, size));
    const videoSpec = FMGO_VIDEO_MODEL_SPECS[name];
    if (!videoSpec) return [];
    const resolutions = videoSpec.resolutions.length ? videoSpec.resolutions : [""];
    return Array.from(new Set(resolutions.flatMap((resolution) => (videoSpec.durationsByResolution?.[resolution] || videoSpec.durations).map((seconds) => videoRequestModel(name, resolution, seconds)))));
}

export function fmgoRatio(size: string, ratios: readonly string[], fallback = ratios[0]) {
    if (ratios.includes(size)) return size;
    const match = size.match(/^(\d+)[x:](\d+)$/);
    if (!match) return fallback;
    const target = Number(match[1]) / Number(match[2]);
    return ratios.reduce((best, item) => Math.abs(readRatio(item) - target) < Math.abs(readRatio(best) - target) ? item : best, fallback);
}

function videoSpec(endpoint: "chat" | "videos", durations: readonly number[], ratios: readonly string[], resolutions: readonly string[], maxReferences: number, appendResolutionDuration = false): FmgoVideoSpec {
    return { endpoint, durations, ratios, resolutions, defaultResolution: resolutions.includes("720p") ? "720p" : resolutions[0] || "", maxReferences, appendResolutionDuration };
}

function imageRequestModel(name: string, imageSize: string) {
    if (name === "gpt-image-2") return imageSize === "2K" ? "gpt-image-2-plus" : imageSize === "4K" ? "gpt-image-2-pro" : name;
    return name === "gemini-3.0-pro-image" ? `${name}-${imageSize.toLowerCase()}` : name;
}

function videoRequestModel(name: string, resolution: string, seconds: number) {
    if (name === "omni") return "gemini-omni-flash";
    if (name === "grok-1.5") return `grok-video-1.5-${seconds}s`;
    if (name === "grok-1.5-fast") return `grok-video-${seconds}s`;
    return FMGO_VIDEO_MODEL_SPECS[name]?.appendResolutionDuration ? `${name}-${resolution}-${seconds}s` : name;
}

function readRatio(value: string) {
    const [width, height] = value.split(":").map(Number);
    return width / height;
}
