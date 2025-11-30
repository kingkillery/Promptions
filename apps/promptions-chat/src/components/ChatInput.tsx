import React from "react";
import { HistoryMessage } from "../types";
import { Textarea, makeStyles, tokens, Button } from "@fluentui/react-components";
import { Send24Regular, Delete24Regular, Info16Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    inputContainer: {
        display: "flex",
        gap: tokens.spacingHorizontalS,
        alignItems: "center",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    containerWrapper: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
    input: {
        flex: 1,
        minHeight: "40px",
    },
    sendButton: {
        minWidth: "32px",
        height: "32px",
        padding: "6px",
    },
    clearButton: {
        minWidth: "32px",
        height: "32px",
        padding: "6px",
    },
    disclaimerText: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground2,
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXXS,
        paddingLeft: tokens.spacingHorizontalXS,
    },
});

type State<T> = { get: T; set: (fn: (prev: T) => void) => void };

interface ChatInputProps {
    disabled: boolean;
    send: (message: string) => void;
    historyState: State<HistoryMessage[]>;
}

export const ChatInput: React.FC<ChatInputProps> = (props) => {
    const { disabled, send, historyState } = props;
    const [text, setText] = React.useState("");
    const styles = useStyles();

    const onSend = () => {
        if (text.trim()) {
            setText("");
            send(text);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey && !disabled && !event.repeat && text.trim()) {
            event.preventDefault();
            onSend();
        }
    };

    return (
        <div className={styles.containerWrapper} role="form" aria-label="Chat message input">
            <div className={styles.inputContainer}>
                <Textarea
                    value={text}
                    disabled={disabled}
                    placeholder="Type your message here... (Press Enter to send)"
                    autoComplete="off"
                    autoFocus
                    className={styles.input}
                    onChange={(_, data) => setText(data.value)}
                    onKeyDown={handleKeyDown}
                    resize="vertical"
                    aria-label="Message input"
                    aria-describedby="chat-disclaimer"
                />
                <Button
                    appearance="primary"
                    disabled={disabled || !text.trim()}
                    onClick={onSend}
                    className={styles.sendButton}
                    icon={<Send24Regular />}
                    title="Send message"
                    aria-label="Send message"
                />
                <Button
                    appearance="subtle"
                    onClick={() => {
                        historyState.set(() => []);
                    }}
                    className={styles.clearButton}
                    icon={<Delete24Regular />}
                    title="Clear chat"
                    aria-label="Clear chat history"
                />
            </div>
            <div id="chat-disclaimer" className={styles.disclaimerText} role="note">
                <Info16Regular aria-hidden="true" />
                AI generated responses should be verified before taking action.
            </div>
        </div>
    );
};
