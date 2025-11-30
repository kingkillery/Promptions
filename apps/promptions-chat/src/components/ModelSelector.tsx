import React, { useState } from "react";
import {
    makeStyles,
    tokens,
    Text,
    Card,
    CardHeader,
    Button,
    Input,
    Divider,
    Badge,
} from "@fluentui/react-components";
import { Add16Regular, Delete16Regular, Checkmark16Regular } from "@fluentui/react-icons";
import { useModelConfig, Provider, providerDisplayNames, ModelInfo } from "../config/ModelConfig";

const useStyles = makeStyles({
    card: {
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    sectionTitle: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalXS,
    },
    providerSection: {
        marginBottom: tokens.spacingVerticalM,
    },
    providerHeader: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalS,
    },
    providerName: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
    },
    modelList: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    modelItem: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusSmall,
        cursor: "pointer",
        "&:hover": {
            backgroundColor: tokens.colorNeutralBackground3,
        },
    },
    modelItemSelected: {
        backgroundColor: tokens.colorBrandBackground2,
        "&:hover": {
            backgroundColor: tokens.colorBrandBackground2Hover,
        },
    },
    modelName: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        flex: 1,
    },
    addModelRow: {
        display: "flex",
        gap: tokens.spacingHorizontalXS,
        marginTop: tokens.spacingVerticalS,
    },
    addModelInput: {
        flex: 1,
        minWidth: 0,
    },
    emptyState: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        fontStyle: "italic",
        padding: tokens.spacingVerticalS,
    },
    selectedBadge: {
        marginLeft: tokens.spacingHorizontalXS,
    },
    deleteButton: {
        minWidth: "auto",
        padding: tokens.spacingHorizontalXS,
    },
    description: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground2,
        marginTop: tokens.spacingVerticalXS,
        lineHeight: "1.4",
    },
    currentModel: {
        marginBottom: tokens.spacingVerticalM,
        padding: tokens.spacingHorizontalS,
        backgroundColor: tokens.colorNeutralBackground3,
        borderRadius: tokens.borderRadiusSmall,
    },
    currentModelLabel: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground2,
    },
    currentModelValue: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
    },
});

const providers: Provider[] = ["openai", "gemini", "openrouter"];

interface AddModelInputProps {
    provider: Provider;
    onAdd: (modelId: string) => void;
}

function AddModelInput({ provider, onAdd }: AddModelInputProps) {
    const styles = useStyles();
    const [modelId, setModelId] = useState("");

    const handleAdd = () => {
        const trimmed = modelId.trim();
        if (trimmed) {
            onAdd(trimmed);
            setModelId("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleAdd();
        }
    };

    const placeholders: Record<Provider, string> = {
        openai: "e.g., gpt-4.1, gpt-4o",
        gemini: "e.g., gemini-2.0-flash",
        openrouter: "e.g., anthropic/claude-3.5-sonnet",
    };

    return (
        <div className={styles.addModelRow}>
            <Input
                className={styles.addModelInput}
                size="small"
                placeholder={placeholders[provider]}
                value={modelId}
                onChange={(_, data) => setModelId(data.value)}
                onKeyDown={handleKeyDown}
            />
            <Button
                size="small"
                appearance="primary"
                icon={<Add16Regular />}
                onClick={handleAdd}
                disabled={!modelId.trim()}
            >
                Add
            </Button>
        </div>
    );
}

export function ModelSelector() {
    const styles = useStyles();
    const { providers: providerConfigs, selectedModel, setSelectedModel, addModel, removeModel } = useModelConfig();

    const handleSelectModel = (model: ModelInfo) => {
        if (selectedModel?.id === model.id && selectedModel?.provider === model.provider) {
            // Deselect if clicking the same model
            setSelectedModel(null);
        } else {
            setSelectedModel(model);
        }
    };

    const handleAddModel = (provider: Provider) => (modelId: string) => {
        // Create a display name from the model ID
        const name = modelId.includes("/") ? modelId.split("/").pop() || modelId : modelId;
        addModel(provider, { id: modelId, name });
    };

    const handleRemoveModel = (provider: Provider, modelId: string) => (e: React.MouseEvent) => {
        e.stopPropagation();
        removeModel(provider, modelId);
    };

    return (
        <Card className={styles.card}>
            <CardHeader header={<Text className={styles.sectionTitle}>Model Selection</Text>} />

            {selectedModel ? (
                <div className={styles.currentModel}>
                    <Text className={styles.currentModelLabel}>Current model:</Text>
                    <Text className={styles.currentModelValue}>
                        {selectedModel.name}
                        <Badge appearance="outline" size="small" className={styles.selectedBadge}>
                            {providerDisplayNames[selectedModel.provider]}
                        </Badge>
                    </Text>
                </div>
            ) : (
                <div className={styles.currentModel}>
                    <Text className={styles.currentModelLabel}>No model selected</Text>
                    <Text className={styles.currentModelValue}>Add a model below to get started</Text>
                </div>
            )}

            {providers.map((provider) => {
                const config = providerConfigs[provider];
                return (
                    <div key={provider} className={styles.providerSection}>
                        <div className={styles.providerHeader}>
                            <Text className={styles.providerName}>{providerDisplayNames[provider]}</Text>
                            <Badge appearance="filled" size="small" color="informative">
                                {config.models.length}
                            </Badge>
                        </div>

                        <div className={styles.modelList}>
                            {config.models.length === 0 ? (
                                <Text className={styles.emptyState}>No models added</Text>
                            ) : (
                                config.models.map((model) => {
                                    const isSelected =
                                        selectedModel?.id === model.id && selectedModel?.provider === model.provider;
                                    return (
                                        <div
                                            key={model.id}
                                            className={`${styles.modelItem} ${isSelected ? styles.modelItemSelected : ""}`}
                                            onClick={() => handleSelectModel(model)}
                                        >
                                            {isSelected && <Checkmark16Regular />}
                                            <Text className={styles.modelName}>{model.name}</Text>
                                            <Button
                                                className={styles.deleteButton}
                                                appearance="subtle"
                                                size="small"
                                                icon={<Delete16Regular />}
                                                onClick={handleRemoveModel(provider, model.id)}
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <AddModelInput provider={provider} onAdd={handleAddModel(provider)} />

                        {provider !== "openrouter" && <Divider style={{ marginTop: tokens.spacingVerticalM }} />}
                    </div>
                );
            })}

            <Text className={styles.description}>
                Add models for each provider you want to use. The selected model will be used for chat completions.
            </Text>
        </Card>
    );
}
