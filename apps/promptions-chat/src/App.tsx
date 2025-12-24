import React from "react";
import { FluentProvider, webLightTheme, makeStyles, tokens } from "@fluentui/react-components";
import { ChatOptionsPanel, Login, ErrorBoundary, ChatPanelFSM } from "./components";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ModelConfigProvider, useModelConfig } from "./config/ModelConfig";
import { ApiKeysProvider, useApiKeys } from "./context/ApiKeysContext";
import {
    compactOptionSet,
    basicOptionSet,
    BasicOptions,
    VisualOptionSet,
    AppHeader,
    TamboProvider,
    A2UIProvider,
    registerDefaultA2UIComponents,
} from "@promptions/promptions-ui";

registerDefaultA2UIComponents();

const useStyles = makeStyles({
    root: {
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },
    appContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "row",
        backgroundColor: tokens.colorNeutralBackground1,
        fontFamily: tokens.fontFamilyBase,
        overflow: "hidden",
    },
    chatContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
    },
    chatScrollArea: {
        flex: 1,
        overflowY: "scroll",
        position: "relative",
        scrollBehavior: "smooth",
        "&::-webkit-scrollbar": {
            width: "8px",
        },
        "&::-webkit-scrollbar-track": {
            backgroundColor: tokens.colorNeutralBackground3,
        },
        "&::-webkit-scrollbar-thumb": {
            backgroundColor: tokens.colorNeutralStroke1,
            borderRadius: "4px",
        },
        "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: tokens.colorNeutralStroke2,
        },
    },
});

// Available option sets
const availableOptionSets = [
    { key: "compact", label: "Compact Options", optionSet: compactOptionSet },
    { key: "expanded", label: "Expanded Options", optionSet: basicOptionSet },
];

// Default option set
const defaultOptionSet = basicOptionSet;

function ChatApp() {
    const [currentOptionSet, setCurrentOptionSet] = React.useState<VisualOptionSet<BasicOptions>>(defaultOptionSet);
    const [optionsPanelVisible, setOptionsPanelVisible] = React.useState(false);
    const styles = useStyles();
    const { apiKeys, setApiKeys, serverHasKeys } = useApiKeys();
    const chatContainerRef = React.useRef<HTMLDivElement>(null);

    const handleOptionSetChange = (newOptionSet: VisualOptionSet<BasicOptions>) => {
        setCurrentOptionSet(newOptionSet);
    };

    const handleToggleOptionsPanel = () => {
        setOptionsPanelVisible(!optionsPanelVisible);
    };

    return (
        <div className={styles.root}>
            <AppHeader
                activeMode="chat"
                apiKeys={apiKeys}
                onApiKeysChange={setApiKeys}
                serverHasKeys={serverHasKeys}
            />
            <div className={styles.appContainer}>
                {/* Expanding Sidebar */}
                <ChatOptionsPanel
                    visualOptionSet={currentOptionSet}
                    onOptionSetChange={handleOptionSetChange}
                    availableOptionSets={availableOptionSets}
                    isVisible={optionsPanelVisible}
                    onToggleVisibility={handleToggleOptionsPanel}
                />

                {/* Chat Container */}
                <div className={styles.chatContainer}>
                    <div className={styles.chatScrollArea} ref={chatContainerRef}>
                        <ChatPanelFSM
                            currentOptionSet={currentOptionSet}
                            chatContainerRef={chatContainerRef}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function AppContent() {
    const { isAuthenticated, isLoading } = useAuth();
    const { selectedModel } = useModelConfig();
    const { apiKeys } = useApiKeys();

    const a2uiRequestBody = React.useCallback(
        () => ({
            provider: selectedModel?.provider,
            model: selectedModel?.id,
            apiKeys,
        }),
        [apiKeys, selectedModel],
    );

    if (isLoading) {
        return null;
    }

    if (!isAuthenticated) {
        return <Login />;
    }

    return (
        <TamboProvider>
            <A2UIProvider requestBody={a2uiRequestBody} onError={(err) => console.error("A2UI error:", err)}>
                <ChatApp />
            </A2UIProvider>
        </TamboProvider>
    );
}

function App() {
    return (
        <FluentProvider theme={webLightTheme}>
            <ErrorBoundary>
                <AuthProvider>
                    <ApiKeysProvider>
                        <ModelConfigProvider>
                            <AppContent />
                        </ModelConfigProvider>
                    </ApiKeysProvider>
                </AuthProvider>
            </ErrorBoundary>
        </FluentProvider>
    );
}

export default App;
