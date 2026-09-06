import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { fmgoVideoSelection } from "@/lib/fmgo-models";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { availableRequestModels, type AiConfig } from "@/stores/use-config-store";

const ratioPreviews: Record<string, { width: number; height: number }> = {
    "16:9": { width: 16, height: 9 },
    "9:16": { width: 9, height: 16 },
    "1:1": { width: 1, height: 1 },
    "2:3": { width: 2, height: 3 },
    "3:2": { width: 3, height: 2 },
};

type VideoSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: "vquality" | "size" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark", value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function VideoSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: VideoSettingsPanelProps) {
    const { t } = useTranslation();
    const model = config.videoModel || config.model;
    const requestModels = availableRequestModels(config, model);
    const selection = fmgoVideoSelection(model, config.vquality, config.videoSeconds, config.size, requestModels);
    if (!selection) return null;

    const selectResolution = (resolution: string) => {
        const next = fmgoVideoSelection(model, resolution, config.videoSeconds, config.size, requestModels);
        onConfigChange("vquality", resolution.replace(/p$/i, ""));
        if (next && next.seconds !== config.videoSeconds) onConfigChange("videoSeconds", next.seconds);
    };

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">{t("settingsPanels.video.title")}</div> : null}
                {selection.resolutions.length ? (
                    <SettingGroup title={t("settingsPanels.video.resolution")} color={theme.node.muted}>
                        <div className="grid grid-cols-3 gap-2.5">
                            {selection.resolutions.map((value) => <OptionPill key={value} selected={selection.resolution === value} theme={theme} onClick={() => selectResolution(value)}>{value}</OptionPill>)}
                        </div>
                    </SettingGroup>
                ) : null}
                <SettingGroup title={t("settingsPanels.video.ratio")} color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {selection.ratios.map((value) => (
                            <button key={value} type="button" className="flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-transparent text-sm transition hover:opacity-80" style={{ borderColor: selection.ratio === value ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={() => onConfigChange("size", value)}>
                                <RatioPreview ratio={value} color={theme.node.text} />
                                <span>{value}</span>
                            </button>
                        ))}
                    </div>
                </SettingGroup>
                <SettingGroup title={t("settingsPanels.video.duration")} color={theme.node.muted}>
                    <div className="grid grid-cols-3 gap-2.5">
                        {selection.durations.map((value) => <OptionPill key={value} selected={selection.seconds === String(value)} theme={theme} onClick={() => onConfigChange("videoSeconds", String(value))}>{value}s</OptionPill>)}
                    </div>
                </SettingGroup>
            </div>
        </ImageSettingsTheme>
    );
}

export function videoResolutionLabel(value: string) {
    return value ? `${normalizeVideoResolutionValue(value)}p` : "";
}

export function videoSizeLabel(value: string) {
    if (value in ratioPreviews) return value;
    if (value === "adaptive" || value === "auto") return i18n.t("settingsPanels.video.adaptive");
    const match = value.match(/^(\d+)x(\d+)$/);
    return match ? Number(match[1]) >= Number(match[2]) ? "16:9" : "9:16" : value;
}

export function videoSecondsLabel(value: string) {
    return `${value || "10"}s`;
}

export function normalizeVideoSizeValue(value: string) {
    if (value in ratioPreviews) return value;
    if (value === "auto") return "16:9";
    const match = value.match(/^(\d+)x(\d+)$/);
    return match && Number(match[1]) < Number(match[2]) ? "9:16" : "16:9";
}

export function normalizeVideoResolutionValue(value: string) {
    if (value === "480p" || value === "low") return "480";
    if (value === "720p" || value === "auto" || value === "high" || value === "medium") return "720";
    return value.replace(/p$/i, "") || "720";
}

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return <button type="button" className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80" style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>{children}</button>;
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return <div className="space-y-2.5"><div className="text-xs font-medium" style={{ color }}>{title}</div>{children}</div>;
}

function RatioPreview({ ratio, color }: { ratio: string; color: string }) {
    const { width, height } = ratioPreviews[ratio] || ratioPreviews["16:9"];
    const scale = Math.max(width, height);
    return <span className="rounded-[3px] border-2" style={{ width: Math.max(10, Math.round(width / scale * 26)), height: Math.max(10, Math.round(height / scale * 26)), borderColor: color }} />;
}
