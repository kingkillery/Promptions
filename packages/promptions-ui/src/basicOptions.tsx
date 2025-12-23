import React from "react";
import { makeStyles, tokens, Radio, Checkbox, Text, Label, Switch } from "@fluentui/react-components";
import {
    BasicOptions,
    SingleOptionControl,
    MultiOptionControl,
    BinaryOptionControl,
    CanvasControl,
    basicOptionSet as b,
} from "@promptions/promptions-llm";
import { VisualOptionSet, OptionRenderer } from "./types";

const useStyles = makeStyles({
    "@keyframes slideUp": {
        from: { opacity: 0, transform: "translateY(20px) scale(0.98)" },
        to: { opacity: 1, transform: "translateY(0) scale(1)" },
    },
    optionsContainer: {
        marginBottom: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalM,
        borderRadius: tokens.borderRadiusLarge,
        backgroundColor: "rgba(255, 255, 255, 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid rgba(255, 255, 255, 0.2)`,
        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
        animationName: "slideUp",
        animationDuration: "0.6s",
        animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        animationFillMode: "forwards",
    },
    optionsContainerMain: {
        gridColumn: "span 2",
        minWidth: "600px",
    },
    optionGroup: {
        marginBottom: tokens.spacingVerticalM,
    },
    optionLabel: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightBold,
        marginBottom: tokens.spacingVerticalS,
        color: tokens.colorNeutralForeground1,
        letterSpacing: "-0.01em",
    },
    optionType: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalS,
        fontStyle: "italic",
    },
    choicesContainer: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalM,
    },
    choiceItem: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        padding: tokens.spacingVerticalXS,
    },
    toggleContainer: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    toggleLabel: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground1,
    },
    thoughtContainer: {
        padding: tokens.spacingVerticalM,
        paddingLeft: tokens.spacingHorizontalM,
        marginBottom: tokens.spacingVerticalM,
        borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
        backgroundColor: "rgba(0, 120, 212, 0.05)",
        borderRadius: tokens.borderRadiusMedium,
        fontStyle: "italic",
        backdropFilter: "blur(4px)",
    },
    thoughtTitle: {
        fontSize: tokens.fontSizeBase100,
        fontWeight: tokens.fontWeightBold,
        display: "block",
        marginBottom: "6px",
        color: tokens.colorBrandForeground1,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },
    canvasContainer: {
        width: "100%",
        minHeight: "400px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: tokens.borderRadiusLarge,
        overflow: "hidden",
        backgroundColor: "#fff",
        boxShadow: tokens.shadow8,
    },
    canvasFrame: {
        width: "100%",
        height: "100%",
        border: "none",
    },
});

interface SingleSelectOptionProps {
    option: SingleOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const SingleSelectOption: React.FC<SingleSelectOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
    const styles = useStyles();

    const currentValue = Array.isArray(option.value) ? option.value[0] : option.value;

    return (
        <div className={styles.choicesContainer}>
            {Object.entries(option.options).map(([key, label]) => (
                <div key={key} className={styles.choiceItem}>
                    <Label>
                        <Radio
                            value={key}
                            checked={currentValue === key}
                            disabled={disabled}
                            onChange={() => {
                                if (disabled) return;
                                set(
                                    new BasicOptions(
                                        options.options.map((opt, idx) =>
                                            idx === optionIndex ? { ...opt, value: key } : opt,
                                        ) as any,
                                    ),
                                );
                            }}
                        />
                        {label}
                    </Label>
                </div>
            ))}
        </div>
    );
};

interface MultiSelectOptionProps {
    option: MultiOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const MultiSelectOption: React.FC<MultiSelectOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
    const styles = useStyles();

    return (
        <div className={styles.choicesContainer}>
            {Object.entries(option?.options ?? []).map(([key, label]) => {
                const currentValues = Array.isArray(option.value) ? option.value : [];
                const isChecked = currentValues.includes(key);

                return (
                    <div key={key} className={styles.choiceItem}>
                        <Label>
                            <Checkbox
                                checked={isChecked}
                                disabled={disabled}
                                onChange={() => {
                                    if (disabled) return;
                                    const newValues = isChecked
                                        ? currentValues.filter((v: string) => v !== key)
                                        : [...currentValues, key];

                                    set(
                                        new BasicOptions(
                                            options.options.map((opt, idx) =>
                                                idx === optionIndex ? { ...opt, value: newValues } : opt,
                                            ) as any,
                                        ),
                                    );
                                }}
                            />
                            {label}
                        </Label>
                    </div>
                );
            })}
        </div>
    );
};

interface BinaryOptionProps {
    option: BinaryOptionControl;
    optionIndex: number;
    options: BasicOptions;
    set: (options: BasicOptions) => void;
    disabled: boolean;
}

const BinaryOption: React.FC<BinaryOptionProps> = ({ option, optionIndex, options, set, disabled }) => {
    const styles = useStyles();
    const isEnabled = option.value === "enabled";

    return (
        <div className={styles.toggleContainer}>
            <Label className={styles.toggleLabel}>{isEnabled ? option.options.enabled : option.options.disabled}</Label>
            <Switch
                checked={isEnabled}
                disabled={disabled}
                onChange={(_, data) => {
                    if (disabled) return;
                    const newValue = data.checked ? "enabled" : "disabled";
                    set(
                        new BasicOptions(
                            options.options.map((opt, idx) =>
                                idx === optionIndex ? { ...opt, value: newValue } : opt,
                            ) as any,
                        ),
                    );
                }}
            />
        </div>
    );
};

interface CanvasOptionProps {
    option: CanvasControl;
}

const CanvasOption: React.FC<CanvasOptionProps> = ({ option }) => {
    const styles = useStyles();
    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    React.useEffect(() => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument;
            if (doc) {
                const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
                        * { transition: all 0.2s ease-in-out; }
                    </style>
                </head>
                <body>
                    ${option.code}
                    ${option.setup ? `<script>${option.setup}</script>` : ""}
                </body>
                </html>
                `;
                doc.open();
                doc.write(content);
                doc.close();
            }
        }
    }, [option.code, option.setup]);

    return (
        <div className={styles.canvasContainer}>
            <iframe ref={iframeRef} title={option.label} className={styles.canvasFrame} />
        </div>
    );
};

const MessageOptions: OptionRenderer = ({ options, set, disabled = false }) => {
    const styles = useStyles();

    if (!(options instanceof BasicOptions)) {
        throw new Error("Expected options to be an instance of BasicOptions");
    }

    const metadata = options.getMetadata();

    return (
        <div className={`${styles.optionsContainer} ${metadata.layout === "main" || metadata.layout === "full" ? styles.optionsContainerMain : ""}`}>
            {metadata.thought && (
                <div className={styles.thoughtContainer}>
                    <Text className={styles.thoughtTitle}>
                        System Reasoning
                    </Text>
                    <Text>{metadata.thought}</Text>
                </div>
            )}
            {options.options.map((option: any, optionIndex: number) => (
                <div key={optionIndex} className={styles.optionGroup}>
                    <Text className={styles.optionLabel}>{option.label}</Text>

                    {option.kind === "single-select" ? (
                        <SingleSelectOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    ) : option.kind === "binary-select" ? (
                        <BinaryOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    ) : option.kind === "canvas" ? (
                        <CanvasOption option={option} />
                    ) : (
                        <MultiSelectOption
                            option={option}
                            optionIndex={optionIndex}
                            options={options}
                            set={set}
                            disabled={disabled}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export const basicOptionSet: VisualOptionSet<BasicOptions> = {
    ...b,
    getComponent: () => MessageOptions,
};
