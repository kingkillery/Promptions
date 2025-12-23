import React from "react";
import {
    makeStyles,
    tokens,
    TabList,
    Tab,
    Text,
} from "@fluentui/react-components";
import { Chat24Regular, Image24Regular } from "@fluentui/react-icons";
import { ApiKeysSettings, ApiKeys } from "./ApiKeysSettings";

const useStyles = makeStyles({
    header: {
        display: "flex",
        alignItems: "center",
        height: "48px",
        backgroundColor: tokens.colorNeutralBackground1,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingLeft: tokens.spacingHorizontalL,
        paddingRight: tokens.spacingHorizontalL,
        flexShrink: 0,
    },
    brand: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        marginRight: tokens.spacingHorizontalXL,
    },
    brandIcon: {
        fontSize: "24px",
    },
    brandName: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
    },
    tabList: {
        flex: 1,
    },
    tab: {
        minWidth: "100px",
    },
    rightSection: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
});

export type AppMode = "chat" | "image";

export interface AppHeaderProps {
    activeMode: AppMode;
    apiKeys?: ApiKeys;
    onApiKeysChange?: (keys: ApiKeys) => void;
    serverHasKeys?: {
        openai: boolean;
        gemini: boolean;
        openrouter: boolean;
    };
}

export function AppHeader({ activeMode, apiKeys, onApiKeysChange, serverHasKeys }: AppHeaderProps) {
    const styles = useStyles();

    const handleTabSelect = (_event: unknown, data: { value: unknown }) => {
        const mode = data.value as AppMode;
        if (mode === "chat") {
            window.location.href = "/chat";
        } else if (mode === "image") {
            window.location.href = "/image";
        }
    };

    return (
        <header className={styles.header}>
            <div className={styles.brand}>
                <span className={styles.brandIcon}>🎨</span>
                <Text className={styles.brandName}>Promptions</Text>
            </div>
            <TabList
                className={styles.tabList}
                selectedValue={activeMode}
                onTabSelect={handleTabSelect}
            >
                <Tab
                    className={styles.tab}
                    value="chat"
                    icon={<Chat24Regular />}
                >
                    Chat
                </Tab>
                <Tab
                    className={styles.tab}
                    value="image"
                    icon={<Image24Regular />}
                >
                    Image
                </Tab>
            </TabList>
            {onApiKeysChange && (
                <div className={styles.rightSection}>
                    <ApiKeysSettings
                        apiKeys={apiKeys || {}}
                        onSave={onApiKeysChange}
                        serverHasKeys={serverHasKeys}
                    />
                </div>
            )}
        </header>
    );
}
