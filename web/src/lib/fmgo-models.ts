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
    appendResolution?: boolean;
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
    "sora-2": videoSpec("chat", [4, 8, 12], ["16:9", "9:16"], [], 1),
    "sora-2-pro": videoSpec("chat", [4, 8, 12], ["16:9", "9:16"], [], 1),
    "veo-3.1": videoSpec("chat", [4, 6, 8], ["16:9", "9:16"], ["720p", "1080p"], 3),
    "veo-3.1-fast": videoSpec("chat", [4, 6, 8], ["16:9", "9:16"], ["720p", "1080p"], 3),
    omni: videoSpec("videos", [8, 10], ["16:9", "9:16"], ["720p"], 4),
    "feimiao-v2": videoSpec("chat", [6, 8, 10, 12, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 9, true),
    "feimiao-v2-fast": videoSpec("chat", [6, 8, 10, 12, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 9, true),
    "ss-v2": videoSpec("chat", [10, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 9),
    "ss-v2-fast": videoSpec("chat", [6, 8, 10, 12, 15], ["16:9", "9:16", "1:1", "2:3", "3:2"], ["480p", "720p"], 9),
    "k2.0-fast": { ...videoSpec("videos", [10, 15], ["16:9", "9:16", "1:1"], ["720p"], 4), appendResolution: true },
    "k2.5": videoSpec("videos", [10, 15, 30], ["16:9", "9:16", "1:1"], ["720p"], 4),
    "feimiao-v2-431": videoSpec("videos", [10, 15], ["16:9", "9:16", "1:1"], ["480p", "720p"], 4, true),
    "feimiao-v2-933": videoSpec("videos", [15], ["16:9", "9:16"], ["480p", "720p"], 4),
    "feimiao-v2.5": { ...videoSpec("videos", [5, 10, 15, 30], ["16:9", "9:16", "1:1"], ["480p", "720p"], 4, true), durationsByResolution: { "480p": [5, 10, 15, 30], "720p": [10, 15, 30] } },
    "feimiao-v2-mini": { ...videoSpec("videos", [10, 15], ["16:9", "9:16", "1:1"], ["480p", "720p"], 9, true), durationsByResolution: { "480p": [15], "720p": [10] } },
    "feimiao-v2-903": videoSpec("videos", [15], ["16:9", "9:16"], ["480p", "720p"], 4),
    "minimax-h3": { ...videoSpec("videos", [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], ["16:9", "9:16", "4:3", "3:4", "1:1"], ["768p", "2k"], 9), appendResolution: true },
    "feimiao-v2-431-fast": videoSpec("videos", [10, 15], ["16:9", "9:16", "1:1"], ["480p", "720p"], 4, true),
    "md2.0-933": { ...videoSpec("videos", [15], ["16:9", "9:16", "1:1"], ["480p", "720p"], 4), appendResolution: true },
    "md2.0-900": { ...videoSpec("videos", [15], ["16:9", "9:16", "1:1"], ["720p"], 4), appendResolution: true },
    "md2.5": videoSpec("videos", [30], ["16:9", "9:16", "1:1"], ["720p"], 4),
};

export const FMGO_MODEL_GROUPS = [
    { key: "gemini", models: ["gemini-3.1-flash-image", "gemini-3.0-pro-image"] },
    { key: "gptImage", models: ["gpt-image-2"] },
    { key: "grok", models: ["grok-1.5", "grok-1.5-fast"] },
    { key: "sora", models: ["sora-2", "sora-2-pro"] },
    { key: "veo", models: ["veo-3.1", "veo-3.1-fast"] },
    { key: "omni", models: ["omni"] },
    { key: "minimax", models: ["minimax-h3"] },
    { key: "md", models: ["md2.0-933", "md2.0-900", "md2.5"] },
    { key: "feimiao20Card", models: ["feimiao-v2", "feimiao-v2-fast", "k2.0-fast"] },
    { key: "feimiao20NoCard", models: ["feimiao-v2-431", "feimiao-v2-431-fast", "feimiao-v2-mini", "feimiao-v2-933", "feimiao-v2-903"] },
    { key: "feimiao25", models: ["feimiao-v2.5", "k2.5"] },
    { key: "ss", models: ["ss-v2", "ss-v2-fast"] },
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
    const dynamicVideoModel = Object.entries(FMGO_VIDEO_MODEL_SPECS).find(([base, spec]) => {
        if (spec.appendResolution && spec.resolutions.some((resolution) => lowerName === `${base}-${resolution}`)) return true;
        return spec.appendResolutionDuration && spec.resolutions.some((resolution) => lowerName.startsWith(`${base}-${resolution}-`) && /^\d+s$/i.test(lowerName.slice(`${base}-${resolution}-`.length)));
    });
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
    const spec = FMGO_VIDEO_MODEL_SPECS[name];
    if (spec?.appendResolutionDuration) return `${name}-${resolution}-${seconds}s`;
    return spec?.appendResolution ? `${name}-${resolution}` : name;
}

function readRatio(value: string) {
    const [width, height] = value.split(":").map(Number);
    return width / height;
}
