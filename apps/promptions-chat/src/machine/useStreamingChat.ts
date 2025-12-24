import { useCallback, useEffect } from "react";
import { useMachine } from "@xstate/react";
import { fromCallback, setup } from "xstate";
import { ChatService, ApiKeys } from "../services/ChatService";
import type { ModelInfo } from "../config/ModelConfig";
import type { VisualOptionSet, BasicOptions } from "@promptions/promptions-ui";
import { PromptionsService, ChatMessage } from "../services/PromptionsService";

export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  options?: BasicOptions;
  optionsDone?: boolean;
  contentDone?: boolean;
}

interface ChatContext {
  messages: Message[];
  pendingMessage: string;
  refreshMessageId: string;
  error: string | null;
  selectedModel: ModelInfo | null;
  apiKeys: ApiKeys;
  optionSet: VisualOptionSet<BasicOptions> | null;
}

type ChatEvent =
  | { type: "SEND"; content: string }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "REFRESH_OPTIONS"; messageId: string }
  | { type: "OPTIONS_UPDATE"; options: BasicOptions; done: boolean }
  | { type: "CONTENT_UPDATE"; content: string; done: boolean }
  | { type: "OPTIONS_DONE" }
  | { type: "STREAM_DONE" }
  | { type: "STREAM_ERROR"; error: string }
  | { type: "MODEL_CHANGE"; model: ModelInfo }
  | { type: "API_KEYS_CHANGE"; apiKeys: ApiKeys }
  | { type: "OPTION_SET_CHANGE"; optionSet: VisualOptionSet<BasicOptions> };

type StreamOptionsInput = {
  messages: Message[];
  optionSet: VisualOptionSet<BasicOptions> | null;
  model: ModelInfo | null;
  apiKeys: ApiKeys;
  isRefresh: boolean;
  refreshMessageId: string;
};

type StreamContentInput = {
  messages: Message[];
  optionSet: VisualOptionSet<BasicOptions> | null;
  model: ModelInfo | null;
  apiKeys: ApiKeys;
};

// Helper to convert Message[] to ChatMessage[]
function elaborateMessagesWithOptions(messages: Message[]): ChatMessage[] {
  const output: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      output.push({ role: "user", content: msg.content });
    }
    if (msg.role === "assistant" && msg.options) {
      const options = msg.options;
      if (options.prettyPrintAsConversation) {
        const { question, answer } = options.prettyPrintAsConversation();
        output.push({ role: "assistant", content: question });
        output.push({ role: "user", content: answer });
        output.push({ role: "assistant", content: msg.content });
      } else if (options.prettyPrint) {
        output.push({ role: "user", content: options.prettyPrint() });
        output.push({ role: "assistant", content: msg.content });
      } else {
        output.push({ role: "assistant", content: msg.content });
      }
    }
  }
  return output;
}

const chatSetup = setup({
  types: {} as {
    context: ChatContext;
    events: ChatEvent;
  },
  actors: {
    streamOptions: fromCallback<ChatEvent, StreamOptionsInput>(({ input, sendBack }) => {
      const abortController = new AbortController();
      const chat = new ChatService();

      if (!input.optionSet) {
        sendBack({ type: "OPTIONS_DONE" });
        return () => {};
      }

      const promptions = new PromptionsService(chat, input.optionSet);

      (async () => {
        try {
          // Build history for options request
          const msgs = input.isRefresh ? input.messages.slice(0, -1) : input.messages.slice(0, -2);
          const history = elaborateMessagesWithOptions(msgs);
          const userMessage = input.isRefresh
            ? input.messages.find((m) => m.id === input.refreshMessageId)?.content
            : input.messages[input.messages.length - 2]?.content;

          if (userMessage) {
            history.push({ role: "user", content: userMessage });
          }

          if (input.isRefresh) {
            const refreshMsg = input.messages.find((m) => m.id === input.refreshMessageId);
            if (refreshMsg?.options) {
              await promptions.refreshOptions(refreshMsg.options, history, (options, done) => {
                sendBack({ type: "OPTIONS_UPDATE", options: options as BasicOptions, done });
                if (done) {
                  sendBack({ type: "OPTIONS_DONE" });
                }
              });
            }
          } else {
            await promptions.getOptions(history, (options, done) => {
              sendBack({ type: "OPTIONS_UPDATE", options: options as BasicOptions, done });
              if (done) {
                sendBack({ type: "OPTIONS_DONE" });
              }
            });
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          sendBack({ type: "STREAM_ERROR", error: message });
        }
      })();

      return () => {
        abortController.abort("streamOptions stopped");
      };
    }),

    streamContent: fromCallback<ChatEvent, StreamContentInput>(({ input, sendBack }) => {
      const chat = new ChatService();
      const abortController = new AbortController();

      (async () => {
        try {
          // Build history with options elaborated
          const history: ChatMessage[] = [
            {
              role: "system",
              content:
                "You are a helpful AI chat bot. When responding to a user consider whether they have provided any additional settings or selections. If they have, do not ask them extra follow-up questions but continue with their intent based on the context.",
            },
            ...elaborateMessagesWithOptions(input.messages.slice(0, -1)),
          ];

          // Add the current message's options
          const lastMsg = input.messages[input.messages.length - 1];
          if (lastMsg?.options?.prettyPrint) {
            history.push({ role: "user", content: lastMsg.options.prettyPrint() });
          }

          await chat.streamChat(
            history,
            (content, done) => {
              sendBack({ type: "CONTENT_UPDATE", content, done });
              if (done) {
                sendBack({ type: "STREAM_DONE" });
              }
            },
            { signal: abortController.signal, model: input.model, apiKeys: input.apiKeys },
          );
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          sendBack({ type: "STREAM_ERROR", error: message });
        }
      })();

      return () => {
        abortController.abort("streamContent stopped");
      };
    }),
  },
});

const chatMachine = chatSetup.createMachine({
  id: "streamingChat",
  initial: "idle",
  context: {
    messages: [],
    pendingMessage: "",
    refreshMessageId: "",
    error: null,
    selectedModel: null,
    apiKeys: {},
    optionSet: null,
  },
  states: {
    idle: {
      on: {
        SEND: {
          target: "preparing",
          actions: chatSetup.assign({
            pendingMessage: ({ event }) => (event as { type: "SEND"; content: string }).content,
          }),
        },
        MODEL_CHANGE: {
          actions: chatSetup.assign({
            selectedModel: ({ event }) => (event as { type: "MODEL_CHANGE"; model: ModelInfo }).model,
          }),
        },
        API_KEYS_CHANGE: {
          actions: chatSetup.assign({
            apiKeys: ({ event }) => (event as { type: "API_KEYS_CHANGE"; apiKeys: ApiKeys }).apiKeys,
          }),
        },
        OPTION_SET_CHANGE: {
          actions: chatSetup.assign({
            optionSet: ({ event }) => (event as { type: "OPTION_SET_CHANGE"; optionSet: VisualOptionSet<BasicOptions> }).optionSet,
          }),
        },
      },
    },

    preparing: {
      entry: chatSetup.assign({
        messages: ({ context }) => [
          ...context.messages,
          { id: crypto.randomUUID(), role: "user" as const, content: context.pendingMessage },
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: "",
            options: context.optionSet?.emptyOptions(),
            optionsDone: false,
            contentDone: false,
          },
        ],
        pendingMessage: "",
        error: null,
      }),
      always: "streamingOptions",
    },

    streamingOptions: {
      invoke: {
        src: "streamOptions",
        input: ({ context }) => ({
          messages: context.messages,
          optionSet: context.optionSet,
          model: context.selectedModel,
          apiKeys: context.apiKeys,
          isRefresh: false,
          refreshMessageId: "",
        }),
      },
      on: {
        OPTIONS_UPDATE: {
          actions: chatSetup.assign({
            messages: ({ context, event }) => {
              const e = event as { type: "OPTIONS_UPDATE"; options: BasicOptions; done: boolean };
              const msgs = [...context.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant" && context.optionSet) {
                last.options = context.optionSet.mergeOptions(
                  (last.options || context.optionSet.emptyOptions()) as BasicOptions,
                  e.options,
                );
                last.optionsDone = e.done;
              }
              return msgs;
            },
          }),
        },
        OPTIONS_DONE: { target: "streamingContent" },
        STREAM_ERROR: {
          target: "error",
          actions: chatSetup.assign({
            error: ({ event }) => (event as { type: "STREAM_ERROR"; error: string }).error,
          }),
        },
        CANCEL: {
          target: "idle",
          actions: chatSetup.assign({
            messages: ({ context }) => context.messages.slice(0, -2),
          }),
        },
      },
    },

    streamingContent: {
      invoke: {
        src: "streamContent",
        input: ({ context }) => ({
          messages: context.messages,
          optionSet: context.optionSet,
          model: context.selectedModel,
          apiKeys: context.apiKeys,
        }),
      },
      on: {
        CONTENT_UPDATE: {
          actions: chatSetup.assign({
            messages: ({ context, event }) => {
              const e = event as { type: "CONTENT_UPDATE"; content: string; done: boolean };
              const msgs = [...context.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant") {
                last.content = e.content;
                last.contentDone = e.done;
              }
              return msgs;
            },
          }),
        },
        STREAM_DONE: { target: "complete" },
        STREAM_ERROR: {
          target: "error",
          actions: chatSetup.assign({
            error: ({ event }) => (event as { type: "STREAM_ERROR"; error: string }).error,
          }),
        },
        CANCEL: {
          target: "complete",
          actions: chatSetup.assign({
            messages: ({ context }) => {
              const msgs = [...context.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant") {
                last.contentDone = true;
              }
              return msgs;
            },
          }),
        },
      },
    },

    refreshingOptions: {
      invoke: {
        src: "streamOptions",
        input: ({ context }) => ({
          messages: context.messages,
          optionSet: context.optionSet,
          model: context.selectedModel,
          apiKeys: context.apiKeys,
          isRefresh: true,
          refreshMessageId: context.refreshMessageId,
        }),
      },
      on: {
        OPTIONS_UPDATE: {
          actions: chatSetup.assign({
            messages: ({ context, event }) => {
              const e = event as { type: "OPTIONS_UPDATE"; options: BasicOptions; done: boolean };
              const msgs = [...context.messages];
              const target = msgs.find((m) => m.id === context.refreshMessageId);
              if (target?.role === "assistant" && context.optionSet) {
                target.options = context.optionSet.mergeOptions(
                  (target.options || context.optionSet.emptyOptions()) as BasicOptions,
                  e.options,
                );
                target.optionsDone = e.done;
              }
              return msgs;
            },
          }),
        },
        OPTIONS_DONE: {
          target: "complete",
          actions: chatSetup.assign({ refreshMessageId: "" }),
        },
        STREAM_ERROR: {
          target: "error",
          actions: chatSetup.assign({
            error: ({ event }) => (event as { type: "STREAM_ERROR"; error: string }).error,
            refreshMessageId: "",
          }),
        },
        CANCEL: {
          target: "complete",
          actions: chatSetup.assign({ refreshMessageId: "" }),
        },
      },
    },

    complete: {
      on: {
        SEND: {
          target: "preparing",
          actions: chatSetup.assign({
            pendingMessage: ({ event }) => (event as { type: "SEND"; content: string }).content,
          }),
        },
        REFRESH_OPTIONS: {
          target: "refreshingOptions",
          actions: chatSetup.assign({
            refreshMessageId: ({ event }) => (event as { type: "REFRESH_OPTIONS"; messageId: string }).messageId,
            messages: ({ context, event }) => {
              const e = event as { type: "REFRESH_OPTIONS"; messageId: string };
              // Clear options and content for the refreshed message
              const msgs = [...context.messages];
              const target = msgs.find((m) => m.id === e.messageId);
              if (target?.role === "assistant" && context.optionSet) {
                target.options = context.optionSet.emptyOptions();
                target.optionsDone = false;
                target.content = "";
                target.contentDone = false;
              }
              // Remove all messages after the refresh target
              const idx = msgs.indexOf(target!);
              return msgs.slice(0, idx + 1);
            },
          }),
        },
        MODEL_CHANGE: {
          actions: chatSetup.assign({
            selectedModel: ({ event }) => (event as { type: "MODEL_CHANGE"; model: ModelInfo }).model,
          }),
        },
        API_KEYS_CHANGE: {
          actions: chatSetup.assign({
            apiKeys: ({ event }) => (event as { type: "API_KEYS_CHANGE"; apiKeys: ApiKeys }).apiKeys,
          }),
        },
        OPTION_SET_CHANGE: {
          actions: chatSetup.assign({
            optionSet: ({ event }) => (event as { type: "OPTION_SET_CHANGE"; optionSet: VisualOptionSet<BasicOptions> }).optionSet,
          }),
        },
      },
    },

    error: {
      on: {
        SEND: {
          target: "preparing",
          actions: chatSetup.assign({
            pendingMessage: ({ event }) => (event as { type: "SEND"; content: string }).content,
          }),
        },
        RETRY: "streamingOptions",
        MODEL_CHANGE: {
          actions: chatSetup.assign({
            selectedModel: ({ event }) => (event as { type: "MODEL_CHANGE"; model: ModelInfo }).model,
          }),
        },
        API_KEYS_CHANGE: {
          actions: chatSetup.assign({
            apiKeys: ({ event }) => (event as { type: "API_KEYS_CHANGE"; apiKeys: ApiKeys }).apiKeys,
          }),
        },
        OPTION_SET_CHANGE: {
          actions: chatSetup.assign({
            optionSet: ({ event }) => (event as { type: "OPTION_SET_CHANGE"; optionSet: VisualOptionSet<BasicOptions> }).optionSet,
          }),
        },
      },
    },
  },
});

export function useStreamingChat(optionSet?: VisualOptionSet<BasicOptions>) {
  const [state, send] = useMachine(chatMachine);

  // Sync optionSet when it changes
  useEffect(() => {
    if (optionSet) {
      send({ type: "OPTION_SET_CHANGE", optionSet });
    }
  }, [optionSet, send]);

  const sendMessage = useCallback(
    (content: string) => {
      send({ type: "SEND", content });
    },
    [send],
  );

  const cancel = useCallback(() => {
    send({ type: "CANCEL" });
  }, [send]);

  const retry = useCallback(() => {
    send({ type: "RETRY" });
  }, [send]);

  const refreshOptions = useCallback(
    (messageId: string) => {
      send({ type: "REFRESH_OPTIONS", messageId });
    },
    [send],
  );

  const setModel = useCallback(
    (model: ModelInfo) => {
      send({ type: "MODEL_CHANGE", model });
    },
    [send],
  );

  const setApiKeys = useCallback(
    (apiKeys: ApiKeys) => {
      send({ type: "API_KEYS_CHANGE", apiKeys });
    },
    [send],
  );

  const currentState = state.value as string;

  return {
    state: currentState,
    messages: state.context.messages,
    error: state.context.error,
    isStreaming: ["streamingOptions", "streamingContent", "refreshingOptions"].includes(currentState),
    isStreamingOptions: currentState === "streamingOptions" || currentState === "refreshingOptions",
    isStreamingContent: currentState === "streamingContent",
    canSend: ["idle", "complete", "error"].includes(currentState),
    sendMessage,
    cancel,
    retry,
    refreshOptions,
    setModel,
    setApiKeys,
  };
}
