import React from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { UserMessage, AssistantMessage, ErrorMessageComponent } from "./";
import { HistoryMessage } from "../types";
import { BasicOptions, VisualOptionSet } from "@promptions/promptions-ui";

const useStyles = makeStyles({
    chatRow: {
        display: "flex",
        width: "100%",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "0",
        marginBottom: tokens.spacingVerticalXL,
    },
    messagesColumn: {
        width: "50%",
        minWidth: "50%",
        display: "flex",
        flexDirection: "column",
    },
    optionsColumn: {
        width: "25%",
        minWidth: "25%",
        paddingLeft: tokens.spacingHorizontalM,
        position: "sticky",
        top: tokens.spacingVerticalL,
    },
    spacerColumn: {
        width: "25%",
    },
    welcomeContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: tokens.spacingHorizontalXL,
    },
    welcomeIcon: {
        fontSize: "64px",
        marginBottom: tokens.spacingVerticalL,
    },
    welcomeTitle: {
        fontSize: tokens.fontSizeBase600,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalM,
    },
    welcomeSubtitle: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
        maxWidth: "400px",
        lineHeight: "1.5",
    },
    refreshButton: {
        minWidth: "24px",
        height: "24px",
        padding: "2px",
        marginBottom: tokens.spacingVerticalS,
    },
    optionsHeader: {
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: tokens.spacingVerticalS,
    },
});

interface ChatHistoryProps {
    history: HistoryMessage[];
    historySet: (fn: (prev: HistoryMessage[]) => void) => void;
    currentOptionSet: VisualOptionSet<BasicOptions>;
    onRefreshOptions: (messageId: string) => void;
    onInteract?: (message: string) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
    history,
    historySet,
    currentOptionSet,
    onInteract,
}) => {
    const styles = useStyles();

    const OptionRenderer = currentOptionSet.getComponent();

    if (history.length === 0) {
        return (
            <div className={styles.chatRow} role="region" aria-label="Welcome message">
                <div className={styles.spacerColumn}></div>
                <div className={styles.messagesColumn}>
                    <div className={styles.welcomeContainer}>
                        <div className={styles.welcomeIcon} aria-hidden="true">🤖</div>
                        <h2 className={styles.welcomeTitle}>Welcome to Promptions AI Chat</h2>
                        <p className={styles.welcomeSubtitle}>Start a conversation by typing a message below.</p>
                    </div>
                </div>
                <div className={styles.optionsColumn}></div>
            </div>
        );
    }

    // Find the latest assistant message
    const latestAssistantMessage = [...history].reverse().find((msg) => msg.role === "assistant");
    const latestAssistantId = latestAssistantMessage?.id;

    const messageElements: JSX.Element[] = [];

    for (let i = 0; i < history.length; i++) {
        const message = history[i];

        if (message.role === "user") {
            messageElements.push(
                <div key={message.id} className={styles.chatRow}>
                    <div className={styles.spacerColumn}></div>
                    <div className={styles.messagesColumn}>
                        <UserMessage message={message} />
                    </div>
                    <div className={styles.optionsColumn}></div>
                </div>,
            );
        } else if (message.role === "assistant") {
            messageElements.push(
                <div key={message.id} className={styles.chatRow}>
                    <div className={styles.spacerColumn}></div>
                    <div className={styles.messagesColumn}>
                        <AssistantMessage message={message} />
                    </div>
                    <div className={styles.optionsColumn}>
                        {message.options && !message.options.isEmpty() && (
                            <>
                                {/* <div className={styles.optionsHeader}>
                                    {onRefreshOptions && (
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            disabled={!message.optionsDone}
                                            icon={<ArrowClockwise24Regular />}
                                            onClick={() => onRefreshOptions(message.id)}
                                            className={styles.refreshButton}
                                            title={message.optionsDone ? "Refresh Options" : "Generating options..."}
                                        />
                                    )}
                                </div> */}
                                <OptionRenderer
                                    options={message.options as any}
                                    set={(updatedOptions) => {
                                        historySet((draft) => {
                                            const msg = draft.find((m) => m.id === message.id);
                                            if (msg && msg.role === "assistant") {
                                                msg.options = updatedOptions as BasicOptions;
                                            }
                                        });

                                        // Only trigger interaction if it's the latest message
                                        if (message.id === latestAssistantId && onInteract) {
                                            const diff = (updatedOptions as BasicOptions).prettyPrint();
                                            onInteract(`[Interaction: User modulated the UI. Current state: ${diff}]`);
                                        }
                                    }}
                                    disabled={message.id !== latestAssistantId}
                                />
                            </>
                        )}
                    </div>
                </div>,
            );
        } else if (message.role === "error") {
            messageElements.push(
                <div key={message.id} className={styles.chatRow}>
                    <div className={styles.spacerColumn}></div>
                    <div className={styles.messagesColumn}>
                        <ErrorMessageComponent message={message} />
                    </div>
                    <div className={styles.optionsColumn}></div>
                </div>,
            );
        }
    }

    return (
        <div role="log" aria-label="Chat conversation" aria-live="polite">
            {messageElements}
        </div>
    );
};
