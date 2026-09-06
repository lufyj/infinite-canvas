import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import { FMGO_MODEL_GROUPS } from "@/lib/fmgo-models";
import { cn } from "@/lib/utils";
import { isModelAvailable, modelOptionLabel, modelOptionName, selectableModelsByCapability, type AiConfig, type ModelCapability } from "@/stores/use-config-store";

type ModelPickerProps = {
    config: AiConfig;
    value?: string;
    onChange: (model: string) => void;
    capability?: ModelCapability;
    className?: string;
    fullWidth?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
};

export function ModelPicker({ config, value, onChange, capability, className, fullWidth = false, placeholder, onMissingConfig }: ModelPickerProps) {
    const { t } = useTranslation();
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const options = useMemo(() => Array.from(new Set([...(config.channelMode === "local" && !capability ? [value] : []), ...selectableModelsByCapability(config, capability)].filter((model): model is string => Boolean(model)))), [capability, config, value]);
    const { groups, ungrouped } = useMemo(() => groupModelOptions(options), [options]);
    const current = value || "";
    const pickerPlaceholder = placeholder || t("settingsPanels.model.select");
    const currentLabel = current ? modelOptionLabel(config, current) : pickerPlaceholder;
    const currentAvailable = !current || isModelAvailable(config, current);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    return (
        <Select
            open={open}
            value={current}
            onOpenChange={(nextOpen) => {
                if (nextOpen && !options.length && config.channelMode === "local") onMissingConfig?.();
                if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
                setOpen(nextOpen);
            }}
            onValueChange={onChange}
        >
            <SelectTrigger
                className={cn(
                    "canvas-composer-model-picker h-8 w-fit max-w-full gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal shadow-sm transition-colors",
                    fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
                    "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
                    className,
                )}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                title={currentAvailable ? currentLabel : t("settingsPanels.model.unavailable", { model: currentLabel })}
            >
                <ModelIcon model={current} />
                <span className="canvas-model-picker-text min-w-0 flex-1 truncate text-left">{currentAvailable ? currentLabel : t("settingsPanels.model.unavailable", { model: currentLabel })}</span>
            </SelectTrigger>
            <SelectContent
                data-canvas-no-zoom
                className="z-[1200] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
                position="popper"
                align="start"
                side="bottom"
                sideOffset={6}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                {options.length ? (
                    <>
                        {groups.map((group, index) => (
                            <Fragment key={group.key}>
                                {index ? <SelectSeparator /> : null}
                                <SelectGroup>
                                    <SelectLabel className="px-1.5 py-1.5 font-medium">{t(`settingsPanels.model.groups.${group.key}`)}</SelectLabel>
                                    {group.options.map((model) => <ModelOption key={model} config={config} model={model} />)}
                                </SelectGroup>
                            </Fragment>
                        ))}
                        {ungrouped.length ? (
                            <>
                                {groups.length ? <SelectSeparator /> : null}
                                {ungrouped.map((model) => <ModelOption key={model} config={config} model={model} />)}
                            </>
                        ) : null}
                    </>
                ) : (
                    <SelectItem value="__empty__" disabled>
                        {emptyModelLabel(config, capability)}
                    </SelectItem>
                )}
            </SelectContent>
        </Select>
    );
}

function groupModelOptions(options: string[]) {
    const byName = new Map(options.map((option) => [modelOptionName(option), option]));
    const groups: Array<{ key: string; options: string[] }> = FMGO_MODEL_GROUPS.map((group) => ({ key: group.key, options: group.models.map((model) => byName.get(model)).filter((model): model is string => Boolean(model)) })).filter((group) => group.options.length);
    const grouped = new Set(groups.flatMap((group) => group.options));
    const providerGroups = [
        { key: "openai", pattern: /gpt|chatgpt|codex|(^|[-_.])o[134]($|[-_.])/i },
        { key: "anthropic", pattern: /claude|anthropic/i },
        { key: "google", pattern: /gemini|google/i },
        { key: "deepseek", pattern: /deepseek/i },
        { key: "glm", pattern: /glm|zhipu/i },
        { key: "grokText", pattern: /grok|xai/i },
        { key: "qwen", pattern: /qwen|通义/i },
    ];
    providerGroups.forEach((group) => {
        const matched = options.filter((option) => !grouped.has(option) && group.pattern.test(modelOptionName(option)));
        if (!matched.length) return;
        groups.push({ key: group.key, options: matched });
        matched.forEach((option) => grouped.add(option));
    });
    const ungrouped = options.filter((option) => !grouped.has(option));
    if (ungrouped.length) groups.push({ key: "other", options: ungrouped });
    return { groups, ungrouped: [] as string[] };
}

function ModelOption({ config, model }: { config: AiConfig; model: string }) {
    return (
        <SelectItem value={model} textValue={modelOptionLabel(config, model)}>
            <ModelLabel config={config} model={model} />
        </SelectItem>
    );
}

function emptyModelLabel(config: AiConfig, capability?: ModelCapability) {
    const label = capability ? i18n.t(`settingsPanels.model.capabilities.${capability}`) : "";
    if (capability && config.models.length) return i18n.t("settingsPanels.model.assign", { capability: label });
    return config.models.length ? i18n.t("settingsPanels.model.noMatch", { capability: label }) : i18n.t("settingsPanels.model.addFirst");
}

function ModelLabel({ config, model }: { config: AiConfig; model: string }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <ModelIcon model={model} />
            <span className="truncate">{modelOptionLabel(config, model)}</span>
        </span>
    );
}

function ModelIcon({ model }: { model: string }) {
    const icon = resolveModelIcon(modelOptionName(model));
    return icon ? <img src={icon} alt="" className="size-4 shrink-0 dark:invert" /> : <Cpu className="size-4 shrink-0 opacity-70" />;
}

function resolveModelIcon(model: string) {
    const name = model.toLowerCase();
    if (name.includes("claude") || name.includes("anthropic")) return "/icons/claude.svg";
    if (name.includes("gemini") || name.includes("google")) return "/icons/gemini.svg";
    if (name.includes("gpt") || name.includes("openai")) return "/icons/openai.svg";
    if (name.includes("grok") || name.includes("grok")) return "/icons/grok.svg";
    if (name.includes("deepseek") || name.includes("deepseek")) return "/icons/deepseek.svg";
    if (name.includes("glm") || name.includes("glm")) return "/icons/glm.svg";
    return "";
}
