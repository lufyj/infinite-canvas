import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import i18n from "@/i18n";
import { fmgoLogicalModelName, fmgoModelCapability, fmgoRequestModelIds } from "@/lib/fmgo-models";

export type ApiCallFormat = "openai" | "gemini" | "fmgo";
export type ModelCapability = "image" | "video" | "text" | "audio";
export type ReasoningEffort = "auto" | "low" | "medium" | "high" | "xhigh";

export type ChannelModel = {
    name: string;
    capability: ModelCapability;
    script?: string;
    available?: boolean;
    requestModels?: string[];
};

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
    catalogUpdatedAt?: string;
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    reasoningEffort: ReasoningEffort;
    models: string[];
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
};

export type WebdavSyncConfig = {
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};
export type ConfigTabKey = "channels" | "preferences" | "prompt-sources" | "webdav" | "local-storage";

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
const CHANNEL_MODEL_SEPARATOR = "::";
const FMGO_BASE_URL = "https://api.fmgo.top";
const VIDEO_KEYWORDS = ["video", "sora", "veo", "kling", "wan", "hailuo", "feimiao"];
const AUDIO_KEYWORDS = ["audio", "tts", "speech", "voice", "music", "sound"];
const IMAGE_KEYWORDS = ["seedream", "gpt-image", "image", "dall-e", "dalle", "imagen", "flux", "sdxl", "stable-diffusion", "midjourney"];

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: FMGO_BASE_URL,
    apiKey: "",
    apiFormat: "fmgo",
    channels: [
        {
            id: "default",
            name: i18n.t("config.channels.defaultName"),
            baseUrl: FMGO_BASE_URL,
            apiKey: "",
            apiFormat: "fmgo",
            models: [],
        },
    ],
    model: "",
    imageModel: "",
    videoModel: "",
    textModel: "",
    audioModel: "",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "10",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    reasoningEffort: "auto",
    models: [],
    quality: "1K",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "3",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

type ConfigStore = {
    config: AiConfig;
    webdav: WebdavSyncConfig;
    modelCatalogStatus: "idle" | "loading" | "success" | "error";
    modelCatalogError: string;
    isConfigOpen: boolean;
    configTab: ConfigTabKey;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, tab?: ConfigTabKey) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
    startModelCatalogRefresh: () => void;
    applyModelCatalog: (models: string[]) => void;
    failModelCatalogRefresh: (error: string) => void;
};

export function boolConfig(value: string, fallback: boolean) {
    return value ? value === "true" : fallback;
}

/** Resolve the fixed capability of a documented FMGO model. */
export function guessCapability(name: string): ModelCapability {
    const fmgoCapability = fmgoModelCapability(name);
    if (fmgoCapability) return fmgoCapability;
    const value = name.toLowerCase();
    if (VIDEO_KEYWORDS.some((keyword) => value.includes(keyword))) return "video";
    if (AUDIO_KEYWORDS.some((keyword) => value.includes(keyword))) return "audio";
    if (IMAGE_KEYWORDS.some((keyword) => value.includes(keyword))) return "image";
    return "text";
}

function findChannelModel(config: AiConfig, value: string): { channel: ModelChannel; model: ChannelModel } | null {
    const decoded = decodeChannelModel(value);
    const name = decoded?.model || value;
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : config.channels.find((item) => item.models.some((model) => model.name === name));
    const model = channel?.models.find((item) => item.name === name);
    return channel && model ? { channel, model } : null;
}

export function modelCapabilityOf(config: AiConfig, value: string): ModelCapability | undefined {
    return findChannelModel(config, value)?.model.capability || fmgoModelCapability(modelOptionName(value));
}

export function isModelAvailable(config: AiConfig, value: string) {
    return findChannelModel(config, value)?.model.available === true;
}

export function availableRequestModels(config: AiConfig, value: string) {
    const model = findChannelModel(config, value)?.model;
    return model?.available === true ? model.requestModels || [] : [];
}

export function assertModelAvailable(config: AiConfig, value: string) {
    if (!isModelAvailable(config, value)) throw new Error(i18n.t("settingsPanels.model.unavailable", { model: modelOptionName(value) }));
}

export function modelMatchesCapability(config: AiConfig, value: string, capability?: ModelCapability) {
    if (!capability) return true;
    return modelCapabilityOf(config, value) === capability;
}

export function resolveModelForCapability(config: AiConfig, currentModel: string | undefined, capability: ModelCapability) {
    const defaultModel = capability === "image" ? config.imageModel : capability === "video" ? config.videoModel : capability === "audio" ? config.audioModel : config.textModel;
    const fallbackModel = capability === "image" ? defaultConfig.imageModel : capability === "video" ? defaultConfig.videoModel : capability === "audio" ? defaultConfig.audioModel : defaultConfig.textModel;
    if (currentModel && (modelMatchesCapability(config, currentModel, capability) || !findChannelModel(config, currentModel))) return currentModel;
    if (defaultModel && modelMatchesCapability(config, defaultModel, capability)) return defaultModel;
    return fallbackModel;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config.channels.flatMap((channel) => channel.models.filter((model) => model.available === true && model.capability === capability).map((model) => encodeChannelModel(channel.id, model.name)));
}

export function availableModelCount(channel: ModelChannel) {
    return channel.models.filter((model) => model.available === true).length;
}

/** The user script (if any) attached to a model; empty string means use the system default call. */
export function resolveModelScript(config: AiConfig, value: string) {
    return findChannelModel(config, value)?.model.script?.trim() || "";
}

function isAiConfigReady(config: AiConfig, model: string) {
    const channel = resolveModelChannel(config, model);
    return Boolean(model.trim() && isModelAvailable(config, model) && channel.baseUrl.trim() && channel.apiKey.trim());
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set) => ({
            config: defaultConfig,
            webdav: defaultWebdavSyncConfig,
            modelCatalogStatus: "idle",
            modelCatalogError: "",
            isConfigOpen: false,
            configTab: "channels",
            shouldPromptContinue: false,
            updateConfig: (key, value) => set((state) => ({ config: normalizeAiConfig({ ...state.config, [key]: value }) })),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, configTab = "channels") => set({ isConfigOpen: true, shouldPromptContinue, configTab }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
            startModelCatalogRefresh: () => set({ modelCatalogStatus: "loading", modelCatalogError: "" }),
            applyModelCatalog: (models) =>
                set((state) => {
                    const currentChannel = state.config.channels[0] || createModelChannel({ baseUrl: state.config.baseUrl, apiKey: state.config.apiKey });
                    const channel = createModelChannel({
                        ...currentChannel,
                        models: mergeFetchedModelCatalog(currentChannel.models, models),
                        catalogUpdatedAt: new Date().toISOString(),
                    });
                    return {
                        config: normalizeAiConfig({ ...state.config, channels: [channel] }),
                        modelCatalogStatus: "success",
                        modelCatalogError: "",
                    };
                }),
            failModelCatalogRefresh: (modelCatalogError) => set({ modelCatalogStatus: "error", modelCatalogError }),
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: state.config, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                return {
                    ...current,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config: normalizeAiConfig(persistedConfig),
                };
            },
        },
    ),
);

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

/** Normalize a mixed list of raw model names or model objects into deduped ChannelModel entries. */
export function normalizeChannelModels(models: Array<string | ChannelModel> | undefined): ChannelModel[] {
    const seen = new Set<string>();
    const result: ChannelModel[] = [];
    for (const item of models || []) {
        const name = (typeof item === "string" ? item : item?.name || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const capability = typeof item === "string" ? guessCapability(name) : item.capability || guessCapability(name);
        const script = typeof item === "string" ? undefined : item.script?.trim() || undefined;
        const available = typeof item !== "string" && item.available === true;
        const requestModels = typeof item === "string" ? undefined : uniqueModelOptions(item.requestModels || []);
        result.push({ name, capability, script, available, ...(requestModels?.length ? { requestModels } : {}) });
    }
    return result;
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    return {
        id: "default",
        name: i18n.t("config.channels.defaultName"),
        baseUrl: channel?.baseUrl?.trim() || FMGO_BASE_URL,
        apiKey: channel?.apiKey || "",
        apiFormat: "fmgo",
        models: normalizeChannelModels(channel?.models),
        catalogUpdatedAt: channel?.catalogUpdatedAt || "",
    };
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    if (channel?.apiFormat === "fmgo") return decoded.model;
    return channel ? `${decoded.model}（${channel.name}）` : decoded.model;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.filter((model) => model.available === true).map((model) => encodeChannelModel(channel.id, model.name))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        return channel && channel.models.some((item) => item.name === decoded.model && item.available === true) ? model : "";
    }
    const channel = channels.find((item) => item.models.some((entry) => entry.name === model)) || channels[0];
    return channel && channel.models.some((item) => item.name === model && item.available === true) ? encodeChannelModel(channel.id, model) : "";
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.some((item) => item.name === model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: i18n.t("config.channels.defaultName"), baseUrl: config.baseUrl, apiKey: config.apiKey, apiFormat: config.apiFormat, models: config.models.map(modelOptionName).map((name) => ({ name, capability: guessCapability(name) })) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: channel.apiFormat,
    };
}

export function normalizeAiConfig(value: Partial<AiConfig>): AiConfig {
    const config = { ...defaultConfig, ...value };
    const persistedChannels = Array.isArray(value.channels) ? value.channels : [];
    const source = persistedChannels.find((channel) => channel.apiFormat === "fmgo") || persistedChannels[0];
    const channel = createModelChannel({
        baseUrl: source ? source.baseUrl : value.baseUrl || FMGO_BASE_URL,
        apiKey: source ? source.apiKey : value.apiKey || "",
        models: source?.models,
        catalogUpdatedAt: source?.catalogUpdatedAt,
    });
    const channels = [channel];
    const imageModel = normalizeFmgoModelOption(config.imageModel || config.model, channel, "image");
    const videoModel = normalizeFmgoModelOption(config.videoModel, channel, "video");
    const textModel = normalizeFmgoModelOption(config.textModel, channel, "text");
    const audioModel = normalizeFmgoModelOption(config.audioModel, channel, "audio");
    const model = imageModel;
    return {
        ...config,
        channelMode: "local",
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: "fmgo",
        channels,
        models: modelOptionsFromChannels(channels),
        model,
        imageModel,
        videoModel,
        textModel,
        audioModel,
        audioVoice: config.audioVoice || defaultConfig.audioVoice,
        audioFormat: config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: config.audioInstructions || "",
        reasoningEffort: config.reasoningEffort || "auto",
        videoSeconds: config.videoSeconds || defaultConfig.videoSeconds,
        vquality: config.vquality || "720",
        videoGenerateAudio: config.videoGenerateAudio || "true",
        videoWatermark: config.videoWatermark || "false",
        canvasImageCount: config.canvasImageCount || "3",
    };
}

function normalizeFmgoModelOption(value: string | undefined, channel: ModelChannel, capability?: ModelCapability) {
    const name = modelOptionName(value || "");
    const selected = channel.models.find((model) => model.available === true && model.name === name && (!capability || model.capability === capability));
    const fallback = channel.models.find((model) => model.available === true && (!capability || model.capability === capability));
    const model = selected || fallback;
    return model ? encodeChannelModel(channel.id, model.name) : "";
}

function mergeFetchedModelCatalog(previousModels: ChannelModel[], fetchedModels: string[]) {
    const previousByName = new Map(normalizeChannelModels(previousModels).map((model) => [model.name, model]));
    const fetchedByLogicalName = new Map<string, string[]>();
    uniqueModelOptions(fetchedModels).forEach((requestModel) => {
        const name = fmgoLogicalModelName(requestModel);
        const fixedCapability = fmgoModelCapability(name);
        const isLogicalModel = name.toLowerCase() === requestModel.toLowerCase();
        if (fixedCapability && !isLogicalModel && !fmgoRequestModelIds(name).some((candidate) => candidate.toLowerCase() === requestModel.toLowerCase())) return;
        fetchedByLogicalName.set(name, [...(fetchedByLogicalName.get(name) || []), requestModel]);
    });
    const availableModels = Array.from(fetchedByLogicalName.entries()).flatMap(([name, requestModels]): ChannelModel[] => {
        const previous = previousByName.get(name);
        const fixedCapability = fmgoModelCapability(name);
        const capability = fixedCapability || (previous?.capability === "audio" || previous?.capability === "text" ? previous.capability : guessCapability(name));
        if (!fixedCapability && (capability === "image" || capability === "video")) return [];
        const hasOnlyLogicalName = fixedCapability && requestModels.every((requestModel) => requestModel.toLowerCase() === name.toLowerCase());
        const availableRequests = hasOnlyLogicalName ? fmgoRequestModelIds(name) : requestModels;
        return [{ name, capability, script: previous?.script, available: true, requestModels: availableRequests }];
    });
    const availableNames = new Set(availableModels.map((model) => model.name));
    const unavailableModels = Array.from(previousByName.values()).filter((model) => !availableNames.has(model.name)).map((model) => ({ ...model, available: false }));
    return [...availableModels, ...unavailableModels];
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function buildApiUrl(baseUrl: string, path: string) {
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}
