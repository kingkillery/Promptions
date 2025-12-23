import React from "react";
import {
    makeStyles,
    tokens,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Input,
    Label,
    Text,
    Tooltip,
    Badge,
} from "@fluentui/react-components";
import {
    Settings24Regular,
    Key24Regular,
    Eye24Regular,
    EyeOff24Regular,
    Checkmark24Regular,
    Dismiss24Regular,
    Info16Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
        minWidth: "450px",
    },
    keySection: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    keyHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    labelRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
    },
    inputRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    input: {
        flex: 1,
    },
    statusBadge: {
        marginLeft: tokens.spacingHorizontalS,
    },
    infoText: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        marginTop: tokens.spacingVerticalXS,
    },
    warning: {
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorPaletteYellowBackground1,
        borderRadius: tokens.borderRadiusMedium,
        fontSize: tokens.fontSizeBase200,
        display: "flex",
        alignItems: "flex-start",
        gap: tokens.spacingHorizontalS,
    },
});

export interface ApiKeys {
    openai?: string;
    gemini?: string;
    openrouter?: string;
}

export interface ApiKeysSettingsProps {
    apiKeys: ApiKeys;
    onSave: (keys: ApiKeys) => void;
    serverHasKeys?: {
        openai: boolean;
        gemini: boolean;
        openrouter: boolean;
    };
}

interface KeyInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    serverHasKey?: boolean;
}

function KeyInput({ label, value, onChange, placeholder, serverHasKey }: KeyInputProps) {
    const styles = useStyles();
    const [showKey, setShowKey] = React.useState(false);

    return (
        <div className={styles.keySection}>
            <div className={styles.keyHeader}>
                <div className={styles.labelRow}>
                    <Label weight="semibold">{label}</Label>
                    {serverHasKey && (
                        <Badge
                            className={styles.statusBadge}
                            appearance="tint"
                            color="success"
                            size="small"
                        >
                            Server configured
                        </Badge>
                    )}
                    {value && (
                        <Badge
                            className={styles.statusBadge}
                            appearance="tint"
                            color="brand"
                            size="small"
                        >
                            Custom key set
                        </Badge>
                    )}
                </div>
            </div>
            <div className={styles.inputRow}>
                <Input
                    className={styles.input}
                    type={showKey ? "text" : "password"}
                    value={value}
                    onChange={(_, data) => onChange(data.value)}
                    placeholder={serverHasKey ? "Using server key (override optional)" : placeholder}
                    contentAfter={
                        <Button
                            appearance="transparent"
                            size="small"
                            icon={showKey ? <EyeOff24Regular /> : <Eye24Regular />}
                            onClick={() => setShowKey(!showKey)}
                            aria-label={showKey ? "Hide key" : "Show key"}
                        />
                    }
                />
                {value && (
                    <Tooltip content="Clear" relationship="label">
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<Dismiss24Regular />}
                            onClick={() => onChange("")}
                            aria-label="Clear key"
                        />
                    </Tooltip>
                )}
            </div>
        </div>
    );
}

export function ApiKeysSettings({ apiKeys, onSave, serverHasKeys }: ApiKeysSettingsProps) {
    const styles = useStyles();
    const [open, setOpen] = React.useState(false);
    const [localKeys, setLocalKeys] = React.useState<ApiKeys>(apiKeys);

    // Sync local state when dialog opens
    React.useEffect(() => {
        if (open) {
            setLocalKeys(apiKeys);
        }
    }, [open, apiKeys]);

    const handleSave = () => {
        onSave(localKeys);
        setOpen(false);
    };

    const hasAnyKey = localKeys.openai || localKeys.gemini || localKeys.openrouter;
    const hasServerKeys = serverHasKeys?.openai || serverHasKeys?.gemini || serverHasKeys?.openrouter;

    return (
        <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Tooltip content="API Keys Settings" relationship="label">
                    <Button
                        appearance="subtle"
                        icon={<Settings24Regular />}
                        aria-label="API Keys Settings"
                    />
                </Tooltip>
            </DialogTrigger>
            <DialogSurface aria-label="API Keys Settings dialog">
                <DialogBody>
                    <DialogTitle>
                        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                            <Key24Regular />
                            API Keys
                        </div>
                    </DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <div className={styles.warning}>
                            <Info16Regular />
                            <Text>
                                Your API keys are stored locally in your browser and sent securely with each request.
                                They are never stored on our servers.
                            </Text>
                        </div>

                        <KeyInput
                            label="OpenAI API Key"
                            value={localKeys.openai || ""}
                            onChange={(value) => setLocalKeys({ ...localKeys, openai: value })}
                            placeholder="sk-..."
                            serverHasKey={serverHasKeys?.openai}
                        />

                        <KeyInput
                            label="Google Gemini API Key"
                            value={localKeys.gemini || ""}
                            onChange={(value) => setLocalKeys({ ...localKeys, gemini: value })}
                            placeholder="AIza..."
                            serverHasKey={serverHasKeys?.gemini}
                        />

                        <KeyInput
                            label="OpenRouter API Key"
                            value={localKeys.openrouter || ""}
                            onChange={(value) => setLocalKeys({ ...localKeys, openrouter: value })}
                            placeholder="sk-or-..."
                            serverHasKey={serverHasKeys?.openrouter}
                        />

                        {!hasAnyKey && !hasServerKeys && (
                            <Text className={styles.infoText}>
                                At least one API key is required to use the chat and image features.
                            </Text>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                        <Button
                            appearance="primary"
                            icon={<Checkmark24Regular />}
                            onClick={handleSave}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}
