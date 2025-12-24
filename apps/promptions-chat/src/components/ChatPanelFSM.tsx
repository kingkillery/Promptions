import { useRef, useLayoutEffect, useEffect } from "react";
import { useStreamingChat, Message } from "../machine/useStreamingChat";
import { useModelConfig } from "../config/ModelConfig";
import { useApiKeys } from "../context/ApiKeysContext";
import { ChatInput } from "./ChatInput";
import { ChatHistory } from "./ChatHistory";
import { PromptExport } from "./PromptExport";
import { A2UIPanel } from "./A2UIPanel";
import type { VisualOptionSet, BasicOptions } from "@promptions/promptions-ui";
import { tokens, makeStyles } from "@fluentui/react-components";

const useStyles = makeStyles({
  chatPanel: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    position: "relative",
  },
  messagesContainer: {
    flex: 1,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
  },
  inputContainer: {
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    position: "sticky",
    bottom: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "center",
  },
  inputWrapper: {
    width: "50%",
    maxWidth: "800px",
  },
});

interface ChatPanelFSMProps {
  currentOptionSet: VisualOptionSet<BasicOptions>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
}

// Adapter to convert FSM messages to HistoryMessage format expected by ChatHistory
function adaptMessages(messages: Message[], optionSet: VisualOptionSet<BasicOptions>) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    options: m.options || optionSet.emptyOptions(),
    optionsDone: m.optionsDone ?? false,
    contentDone: m.contentDone ?? false,
  }));
}

export function ChatPanelFSM({ currentOptionSet, chatContainerRef }: ChatPanelFSMProps) {
  const styles = useStyles();
  const { selectedModel } = useModelConfig();
  const { apiKeys } = useApiKeys();
  const pendingScroll = useRef(false);
  const prevMessagesLength = useRef(0);

  const {
    messages,
    isStreaming,
    sendMessage,
    refreshOptions,
    setModel,
    setApiKeys: setFsmApiKeys,
  } = useStreamingChat(currentOptionSet);

  // Sync model and apiKeys to FSM
  useEffect(() => {
    if (selectedModel) {
      setModel(selectedModel);
    }
  }, [selectedModel, setModel]);

  useEffect(() => {
    setFsmApiKeys(apiKeys);
  }, [apiKeys, setFsmApiKeys]);

  // Auto-scroll on new messages or content updates
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      pendingScroll.current = true;
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  useLayoutEffect(() => {
    if (pendingScroll.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        behavior: "smooth",
        top: chatContainerRef.current.scrollHeight,
      });
      pendingScroll.current = false;
    }
  });

  // Build A2UI prompt from last exchange
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const a2uiPrompt = lastUserMessage
    ? [
        `User request:\n${lastUserMessage.content}`,
        lastAssistantMessage?.content ? `\n\nAssistant response:\n${lastAssistantMessage.content}` : "",
      ].join("")
    : undefined;

  // Adapted history for ChatHistory component
  const adaptedHistory = adaptMessages(messages, currentOptionSet);

  // Create historyState adapter for ChatHistory (read-only for FSM)
  const historyState = {
    get: adaptedHistory,
    set: () => {}, // FSM manages state internally
  };

  const handleRefreshOptions = (messageId: string) => {
    refreshOptions(messageId);
  };

  const handleInteract = (message: string) => {
    sendMessage(message);
  };

  const lastResponse = messages[messages.length - 1];
  const isInputDisabled =
    isStreaming || (lastResponse?.role === "assistant" && (!lastResponse.optionsDone || !lastResponse.contentDone));

  return (
    <div className={styles.chatPanel}>
      <div className={styles.messagesContainer}>
        <ChatHistory
          history={adaptedHistory}
          historySet={() => {}}
          currentOptionSet={currentOptionSet}
          onRefreshOptions={handleRefreshOptions}
          onInteract={handleInteract}
        />
        <A2UIPanel prompt={a2uiPrompt} />
      </div>
      <div className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          <ChatInput disabled={isInputDisabled} send={sendMessage} historyState={historyState} />
        </div>
        <PromptExport history={adaptedHistory} />
      </div>
    </div>
  );
}
