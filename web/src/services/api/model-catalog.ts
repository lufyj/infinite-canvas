import { fetchChannelModels } from "@/services/api/image";
import { useConfigStore } from "@/stores/use-config-store";

let activeRefresh: { key: string; promise: Promise<number> } | null = null;

export function refreshDefaultModelCatalog() {
    const channel = useConfigStore.getState().config.channels[0];
    if (!channel?.baseUrl.trim() || !channel.apiKey.trim()) return Promise.resolve(0);
    const key = `${channel.baseUrl.trim()}\n${channel.apiKey}`;
    if (activeRefresh?.key === key) return activeRefresh.promise;

    const promise = (async () => {
        useConfigStore.getState().startModelCatalogRefresh();
        try {
            const models = await fetchChannelModels(channel);
            const current = useConfigStore.getState().config.channels[0];
            if (!current || `${current.baseUrl.trim()}\n${current.apiKey}` !== key) return 0;
            useConfigStore.getState().applyModelCatalog(models);
            return useConfigStore.getState().config.models.length;
        } catch (error) {
            const current = useConfigStore.getState().config.channels[0];
            if (current && `${current.baseUrl.trim()}\n${current.apiKey}` === key) {
                useConfigStore.getState().failModelCatalogRefresh(error instanceof Error ? error.message : String(error));
            }
            throw error;
        } finally {
            if (activeRefresh?.key === key) activeRefresh = null;
        }
    })();
    activeRefresh = { key, promise };
    return promise;
}
