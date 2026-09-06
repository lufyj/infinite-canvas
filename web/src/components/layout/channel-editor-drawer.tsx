import { App, Button, Drawer, Input, Segmented, Space } from "antd";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { refreshDefaultModelCatalog } from "@/services/api/model-catalog";
import { normalizeChannelModels, useConfigStore, type ChannelModel, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";
import { ModelScriptEditor } from "./model-script-editor";

type ScriptTarget = { name: string; capability: ModelCapability; value: string };

export function ChannelEditorDrawer({ open, channel, onSave, onClose }: { open: boolean; channel: ModelChannel | null; onSave: (channel: ModelChannel) => void; onClose: () => void }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [scriptTarget, setScriptTarget] = useState<ScriptTarget | null>(null);
    const catalogStatus = useConfigStore((state) => state.modelCatalogStatus);
    const catalogError = useConfigStore((state) => state.modelCatalogError);

    useEffect(() => {
        if (open && channel) setDraft(channel);
    }, [open, channel]);

    if (!draft) return null;

    const availableModels = draft.models.filter((model) => model.available === true);
    const modelGroups = (["text", "image", "video", "audio"] as ModelCapability[])
        .map((capability) => ({ capability, models: availableModels.filter((model) => model.capability === capability) }))
        .filter((group) => group.models.length);
    const capabilityOptions: Array<{ label: string; value: ModelCapability }> = ["text", "audio"].map((value) => ({ label: t(`config.channelEditor.capabilities.${value}`), value: value as ModelCapability }));
    const setModels = (models: ChannelModel[]) => setDraft({ ...draft, models });

    const setCapability = (name: string, capability: ModelCapability) => setModels(draft.models.map((model) => (model.name === name ? { ...model, capability } : model)));
    const setScript = (name: string, script: string) => setModels(draft.models.map((model) => (model.name === name ? { ...model, script: script || undefined } : model)));

    const normalizedDraft = () => {
        const credentialsChanged = draft.baseUrl.trim() !== channel?.baseUrl.trim() || draft.apiKey !== channel?.apiKey;
        return {
            ...draft,
            id: "default",
            name: t("config.channels.defaultName"),
            apiFormat: "fmgo" as const,
            models: normalizeChannelModels(draft.models).map((model) => credentialsChanged ? { ...model, available: false } : model),
            catalogUpdatedAt: credentialsChanged ? "" : draft.catalogUpdatedAt,
        };
    };

    const save = () => {
        onSave(normalizedDraft());
        onClose();
    };

    const refreshModels = async () => {
        onSave(normalizedDraft());
        try {
            const count = await refreshDefaultModelCatalog();
            message.success(t("config.channelEditor.refreshed", { count }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.modelSelect.fetchFailed"));
        }
    };

    return (
        <Drawer
            open={open}
            width={640}
            title={t("config.channelEditor.title")}
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={onClose}>{t("common.cancel")}</Button>
                    <Button type="primary" onClick={save}>{t("common.save")}</Button>
                </Space>
            }
        >
            <div className="grid gap-4">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.baseUrl")}</span>
                    <Input value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.fmgo.top" />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">API Key</span>
                    <Input.Password value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder="sk-..." />
                </label>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                    {t("config.channelEditor.modelDescription", { count: availableModels.length })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>{draft.catalogUpdatedAt ? t("config.channelEditor.lastUpdated", { time: new Date(draft.catalogUpdatedAt).toLocaleString() }) : t("config.channelEditor.notSynced")}</span>
                    <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={catalogStatus === "loading"} onClick={() => void refreshModels()}>
                        {t("config.channelEditor.refreshModels")}
                    </Button>
                </div>
                {catalogStatus === "error" && catalogError ? <div className="text-xs text-red-500">{t("config.channelEditor.catalogError", { error: catalogError })}</div> : null}
            </div>

            <div className="mt-6 space-y-5">
                {modelGroups.length ? (
                    modelGroups.map((group) => (
                        <section key={group.capability}>
                            <div className="mb-2 text-sm font-semibold">{t(`config.channelEditor.capabilities.${group.capability}`)} <span className="font-normal text-stone-400">{group.models.length}</span></div>
                            <div className="space-y-1 border-l border-stone-200 pl-3 dark:border-stone-800">
                                {group.models.map((model) => (
                                    <div key={model.name} className="flex flex-wrap items-center gap-3 py-1.5">
                                        <span className="min-w-0 flex-1 truncate text-sm" title={model.name}>{model.name}</span>
                                        {model.capability === "text" || model.capability === "audio" ? (
                                            <div className="flex shrink-0 items-center gap-2">
                                                <Segmented size="small" value={model.capability} options={capabilityOptions} onChange={(value) => setCapability(model.name, value as ModelCapability)} />
                                                <Button size="small" type={model.script ? "primary" : "default"} ghost={Boolean(model.script)} onClick={() => setScriptTarget({ name: model.name, capability: model.capability, value: model.script || "" })}>
                                                    {t(model.script ? "config.channelEditor.scriptReady" : "config.channelEditor.script")}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))
                ) : (
                    <div className="px-2 py-8 text-center text-sm text-stone-500">{t("config.channelEditor.empty")}</div>
                )}
            </div>

            <ModelScriptEditor
                open={Boolean(scriptTarget)}
                capability={scriptTarget?.capability || "text"}
                modelName={scriptTarget?.name || ""}
                value={scriptTarget?.value || ""}
                onSave={(script) => scriptTarget && setScript(scriptTarget.name, script)}
                onClose={() => setScriptTarget(null)}
            />
        </Drawer>
    );
}
