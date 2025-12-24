import { useCallback } from "react";
import { useMachine } from "@xstate/react";
import { fromCallback, fromPromise, setup } from "xstate";
import { ChatService, ApiKeys } from "../services/ChatService";
import type { ModelInfo } from "../config/ModelConfig";

export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  options?: Record<string, unknown>;
  optionsDone?: boolean;
  contentDone?: boolean;
}

interface ChatContext {
  messages: Message[];
  pendingMessage: string;
  error: string | null;
  selectedModel: ModelInfo | null;
  apiKeys: ApiKeys;
}

type ChatEvent =
  | { type: "SEND"; content: string }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "REFRESH_OPTIONS"; messageId: string }
  | { type: "CONTENT_UPDATE"; content: string; done: boolean }
  | { type: "STREAM_DONE" }
  | { type: "STREAM_ERROR"; error: string }
  | { type: "MODEL_CHANGE"; model: ModelInfo }
  | { type: "API_KEYS_CHANGE"; apiKeys: ApiKeys };

type StreamChatInput = {
  messages: Message[];
  model: ModelInfo | null;
  apiKeys: ApiKeys;
};

const chatSetup = setup({
  types: {} as {
    context: ChatContext;
    events: ChatEvent;
  },
  actors: {
    streamChat: fromCallback<ChatEvent, StreamChatInput>(({ input, sendBack }) => {
      const chat = new ChatService();
      const abortController = new AbortController();
      let doneSent = false;

      (async () => {
        try {
          const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = input.messages.map((m) => {
            const role = m.role === "error" ? "system" : m.role;
            return {
              role: role as "user" | "assistant" | "system",
              content: m.content,
            };
          });

          await chat.streamChat(
            history,
            (content, done) => {
              sendBack({ type: "CONTENT_UPDATE", content, done });
              if (done && !doneSent) {
                doneSent = true;
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
        abortController.abort("streamChat stopped");
      };
    }),
    refreshOptions: fromPromise(async () => {
      // Placeholder - implement based on server API.
    }),
  },
});

const chatMachine = chatSetup.createMachine({
  id: "streamingChat",
  initial: "idle",
  context: {
    messages: [],
    pendingMessage: "",
    error: null,
    selectedModel: null,
    apiKeys: {},
  },
  states: {
    idle: {
      on: {
        SEND: {
          target: "preparing",
          actions: chatSetup.assign({
            pendingMessage: ({ context, event }) => (event.type === "SEND" ? event.content : context.pendingMessage),
          }),
        },
        MODEL_CHANGE: {
          actions: chatSetup.assign({
            selectedModel: ({ context, event }) => (event.type === "MODEL_CHANGE" ? event.model : context.selectedModel),
          }),
        },
        API_KEYS_CHANGE: {
          actions: chatSetup.assign({
            apiKeys: ({ context, event }) => (event.type === "API_KEYS_CHANGE" ? event.apiKeys : context.apiKeys),
          }),
        },
      },
    },
    preparing: {
      entry: chatSetup.assign({
        messages: ({ context }) => [
          ...context.messages,
          { id: crypto.randomUUID(), role: "user", content: context.pendingMessage },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "",
            options: {},
            optionsDone: false,
            contentDone: false,
          },
        ],
        pendingMessage: "",
        error: null,
      }),
      always: "streaming",
    },
    streaming: {
      invoke: {
        src: "streamChat",
        input: ({ context }) => ({
          messages: context.messages,
          model: context.selectedModel,
          apiKeys: context.apiKeys,
        }),
      },
      on: {
        CONTENT_UPDATE: {
          actions: chatSetup.assign({
            messages: ({ context, event }) => {
              if (event.type !== "CONTENT_UPDATE") {
                return context.messages;
              }
              const msgs = [...context.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant") {
                last.content = event.content;
                if (event.done) {
                  last.contentDone = true;
                }
              }
              return msgs;
            },
          }),
        },
        STREAM_DONE: { target: "complete" },
        STREAM_ERROR: {
          target: "error",
          actions: chatSetup.assign({
            error: ({ context, event }) => (event.type === "STREAM_ERROR" ? event.error : context.error),
          }),
        },
        CANCEL: {
          target: "idle",
          actions: chatSetup.assign({ messages: ({ context }) => context.messages.slice(0, -1) }),
        },
      },
    },
    complete: {
      on: {
        SEND: {
          target: "preparing",
          actions: chatSetup.assign({
            pendingMessage: ({ context, event }) => (event.type === "SEND" ? event.content : context.pendingMessage),
          }),
        },
        REFRESH_OPTIONS: "refreshing",
        MODEL_CHANGE: {
          actions: chatSetup.assign({
            selectedModel: ({ context, event }) => (event.type === "MODEL_CHANGE" ? event.model : context.selectedModel),
          }),
        },
        API_KEYS_CHANGE: {
          actions: chatSetup.assign({
            apiKeys: ({ context, event }) => (event.type === "API_KEYS_CHANGE" ? event.apiKeys : context.apiKeys),
          }),
        },
      },
    },
    refreshing: {
      invoke: {
        src: "refreshOptions",
        input: ({ context, event }) => ({
          messageId: event.type === "REFRESH_OPTIONS" ? event.messageId : "",
          messages: context.messages,
        }),
        onDone: { target: "complete" },
        onError: { target: "error" },
      },
      on: { CANCEL: "complete" },
    },
    error: {
      on: {
        SEND: {
          target: "preparing",
          actions: chatSetup.assign({
            pendingMessage: ({ context, event }) => (event.type === "SEND" ? event.content : context.pendingMessage),
          }),
        },
        RETRY: "streaming",
        MODEL_CHANGE: {
          actions: chatSetup.assign({
            selectedModel: ({ context, event }) => (event.type === "MODEL_CHANGE" ? event.model : context.selectedModel),
          }),
        },
        API_KEYS_CHANGE: {
          actions: chatSetup.assign({
            apiKeys: ({ context, event }) => (event.type === "API_KEYS_CHANGE" ? event.apiKeys : context.apiKeys),
          }),
        },
      },
    },
  },
});

export function useStreamingChat() {
  const [state, send, actor] = useMachine(chatMachine);

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

  return {
    state,
    messages: state.context.messages,
    error: state.context.error,
    isLoading: ["preparing", "streaming", "refreshing"].includes(state.value as string),
    canSend: ["idle", "complete"].includes(state.value as string),
    sendMessage,
    cancel,
    retry,
    refreshOptions,
    setModel,
    setApiKeys,
    actor,
  };
}
