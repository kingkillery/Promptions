import React from "react";
import {
    Button,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    makeStyles,
    tokens,
    Tab,
    TabList,
    Textarea,
    Tooltip,
    Badge,
} from "@fluentui/react-components";
import {
    ArrowDownload24Regular,
    Copy24Regular,
    Checkmark24Regular,
    Document24Regular,
    Code24Regular,
    History24Regular,
} from "@fluentui/react-icons";
import { HistoryMessage, ResponseMessage, RequestMessage } from "../types";
import { BasicOptions } from "@promptions/promptions-ui";

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        minWidth: "600px",
        maxWidth: "800px",
    },
    tabContent: {
        marginTop: tokens.spacingVerticalM,
    },
    exportPreview: {
        fontFamily: "monospace",
        fontSize: tokens.fontSizeBase200,
        backgroundColor: tokens.colorNeutralBackground3,
        padding: tokens.spacingHorizontalM,
        borderRadius: tokens.borderRadiusMedium,
        maxHeight: "400px",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
    },
    timelineContainer: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        maxHeight: "400px",
        overflow: "auto",
    },
    timelineItem: {
        display: "flex",
        flexDirection: "column",
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        borderLeft: `3px solid ${tokens.colorBrandBackground}`,
    },
    timelineItemUser: {
        borderLeftColor: tokens.colorPaletteBlueBorderActive,
    },
    timelineItemAssistant: {
        borderLeftColor: tokens.colorPaletteGreenBorderActive,
    },
    timelineItemOptions: {
        borderLeftColor: tokens.colorPalettePurpleBorderActive,
    },
    timelineHeader: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalXS,
    },
    timelineRole: {
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
    },
    timelineContent: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        whiteSpace: "pre-wrap",
        maxHeight: "100px",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    optionChange: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        marginTop: tokens.spacingVerticalXS,
    },
    buttonGroup: {
        display: "flex",
        gap: tokens.spacingHorizontalS,
    },
    statsBar: {
        display: "flex",
        gap: tokens.spacingHorizontalM,
        padding: tokens.spacingHorizontalS,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
    },
    statItem: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalXS,
        fontSize: tokens.fontSizeBase200,
    },
});

interface PromptExportProps {
    history: HistoryMessage[];
}

type ExportFormat = "markdown" | "json" | "timeline";

interface ConversationExport {
    exportedAt: string;
    messageCount: number;
    messages: ExportedMessage[];
}

interface ExportedMessage {
    role: "user" | "assistant" | "error";
    content: string;
    options?: {
        label: string;
        selectedValue: string;
        availableOptions: string[];
    }[];
    optionsFormatted?: string;
}

/**
 * Formats options from a ResponseMessage into a readable format
 */
function formatOptions(options: BasicOptions): ExportedMessage["options"] {
    if (!options || options.isEmpty()) return undefined;

    return options.options
        .filter((opt) => opt.kind !== "canvas")
        .map((opt) => {
            let selectedValue: string;
            let availableOptions: string[];

            if (opt.kind === "single-select") {
                const val = Array.isArray(opt.value) ? opt.value[0] : opt.value;
                selectedValue = opt.options[val] || val;
                availableOptions = Object.values(opt.options);
            } else if (opt.kind === "binary-select") {
                selectedValue = opt.options[opt.value];
                availableOptions = [opt.options.enabled, opt.options.disabled];
            } else {
                // multi-select
                const vals = Array.isArray(opt.value) ? opt.value : [opt.value];
                selectedValue = vals.map((v: string) => opt.options[v] || v).join(", ");
                availableOptions = Object.values(opt.options);
            }

            return {
                label: opt.label,
                selectedValue,
                availableOptions,
            };
        });
}

/**
 * Converts history to exportable format
 */
function historyToExport(history: HistoryMessage[]): ConversationExport {
    const messages: ExportedMessage[] = [];

    for (const msg of history) {
        if (msg.role === "user") {
            messages.push({
                role: "user",
                content: (msg as RequestMessage).content,
            });
        } else if (msg.role === "assistant") {
            const assistantMsg = msg as ResponseMessage;
            const options = formatOptions(assistantMsg.options as BasicOptions);
            messages.push({
                role: "assistant",
                content: assistantMsg.content,
                options,
                optionsFormatted: options
                    ? options.map((o) => `${o.label}: ${o.selectedValue}`).join("\n")
                    : undefined,
            });
        } else if (msg.role === "error") {
            messages.push({
                role: "error",
                content: msg.content,
            });
        }
    }

    return {
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages,
    };
}

/**
 * Converts export data to Markdown format
 */
function exportToMarkdown(data: ConversationExport): string {
    let md = `# Promptions Conversation Export\n\n`;
    md += `**Exported:** ${new Date(data.exportedAt).toLocaleString()}\n`;
    md += `**Messages:** ${data.messageCount}\n\n`;
    md += `---\n\n`;

    for (const msg of data.messages) {
        if (msg.role === "user") {
            md += `## 👤 User\n\n${msg.content}\n\n`;
        } else if (msg.role === "assistant") {
            md += `## 🤖 Assistant\n\n`;
            if (msg.options && msg.options.length > 0) {
                md += `### Selected Options\n\n`;
                for (const opt of msg.options) {
                    md += `- **${opt.label}:** ${opt.selectedValue}\n`;
                    md += `  - Available: ${opt.availableOptions.join(", ")}\n`;
                }
                md += `\n`;
            }
            if (msg.content) {
                md += `### Response\n\n${msg.content}\n\n`;
            }
        } else if (msg.role === "error") {
            md += `## ⚠️ Error\n\n${msg.content}\n\n`;
        }
        md += `---\n\n`;
    }

    return md;
}

/**
 * Converts export data to JSON format
 */
function exportToJson(data: ConversationExport): string {
    return JSON.stringify(data, null, 2);
}

export const PromptExport: React.FC<PromptExportProps> = ({ history }) => {
    const styles = useStyles();
    const [selectedTab, setSelectedTab] = React.useState<ExportFormat>("timeline");
    const [copied, setCopied] = React.useState(false);

    const exportData = React.useMemo(() => historyToExport(history), [history]);
    const markdownContent = React.useMemo(() => exportToMarkdown(exportData), [exportData]);
    const jsonContent = React.useMemo(() => exportToJson(exportData), [exportData]);

    const userMessages = history.filter((m) => m.role === "user").length;
    const assistantMessages = history.filter((m) => m.role === "assistant").length;
    const optionsCount = history
        .filter((m) => m.role === "assistant")
        .reduce((acc, m) => {
            const opts = (m as ResponseMessage).options as BasicOptions;
            return acc + (opts?.options?.length || 0);
        }, 0);

    const handleCopy = async () => {
        const content = selectedTab === "markdown" ? markdownContent : jsonContent;
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const content = selectedTab === "markdown" ? markdownContent : jsonContent;
        const extension = selectedTab === "markdown" ? "md" : "json";
        const mimeType = selectedTab === "markdown" ? "text/markdown" : "application/json";

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `promptions-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (history.length === 0) {
        return null;
    }

    return (
        <Dialog>
            <DialogTrigger disableButtonEnhancement>
                <Tooltip content="Export conversation" relationship="label">
                    <Button
                        appearance="subtle"
                        icon={<ArrowDownload24Regular />}
                        aria-label="Export conversation"
                    />
                </Tooltip>
            </DialogTrigger>
            <DialogSurface aria-label="Export conversation dialog">
                <DialogBody>
                    <DialogTitle>Export Conversation</DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        {/* Stats bar */}
                        <div className={styles.statsBar} role="status" aria-label="Conversation statistics">
                            <div className={styles.statItem}>
                                <Badge appearance="filled" color="informative">
                                    {userMessages}
                                </Badge>
                                <span>User messages</span>
                            </div>
                            <div className={styles.statItem}>
                                <Badge appearance="filled" color="success">
                                    {assistantMessages}
                                </Badge>
                                <span>AI responses</span>
                            </div>
                            <div className={styles.statItem}>
                                <Badge appearance="filled" color="important">
                                    {optionsCount}
                                </Badge>
                                <span>Options configured</span>
                            </div>
                        </div>

                        {/* Tab selection */}
                        <TabList
                            selectedValue={selectedTab}
                            onTabSelect={(_, data) => setSelectedTab(data.value as ExportFormat)}
                            aria-label="Export format selection"
                        >
                            <Tab value="timeline" icon={<History24Regular />}>
                                Timeline
                            </Tab>
                            <Tab value="markdown" icon={<Document24Regular />}>
                                Markdown
                            </Tab>
                            <Tab value="json" icon={<Code24Regular />}>
                                JSON
                            </Tab>
                        </TabList>

                        {/* Tab content */}
                        <div className={styles.tabContent}>
                            {selectedTab === "timeline" && (
                                <div
                                    className={styles.timelineContainer}
                                    role="list"
                                    aria-label="Conversation timeline"
                                >
                                    {exportData.messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`${styles.timelineItem} ${
                                                msg.role === "user"
                                                    ? styles.timelineItemUser
                                                    : msg.role === "assistant"
                                                      ? styles.timelineItemAssistant
                                                      : ""
                                            }`}
                                            role="listitem"
                                        >
                                            <div className={styles.timelineHeader}>
                                                <span className={styles.timelineRole}>
                                                    {msg.role === "user"
                                                        ? "👤 You"
                                                        : msg.role === "assistant"
                                                          ? "🤖 AI"
                                                          : "⚠️ Error"}
                                                </span>
                                            </div>
                                            {msg.options && msg.options.length > 0 && (
                                                <div
                                                    className={styles.optionChange}
                                                    aria-label="Selected options"
                                                >
                                                    {msg.options.map((opt, optIdx) => (
                                                        <Badge
                                                            key={optIdx}
                                                            appearance="outline"
                                                            size="small"
                                                        >
                                                            {opt.label}: {opt.selectedValue}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            <div className={styles.timelineContent}>
                                                {msg.content || "(No content)"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedTab === "markdown" && (
                                <Textarea
                                    value={markdownContent}
                                    readOnly
                                    className={styles.exportPreview}
                                    resize="vertical"
                                    aria-label="Markdown export preview"
                                    style={{ minHeight: "300px" }}
                                />
                            )}

                            {selectedTab === "json" && (
                                <Textarea
                                    value={jsonContent}
                                    readOnly
                                    className={styles.exportPreview}
                                    resize="vertical"
                                    aria-label="JSON export preview"
                                    style={{ minHeight: "300px" }}
                                />
                            )}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <div className={styles.buttonGroup}>
                            {selectedTab !== "timeline" && (
                                <>
                                    <Button
                                        appearance="secondary"
                                        icon={copied ? <Checkmark24Regular /> : <Copy24Regular />}
                                        onClick={handleCopy}
                                        aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
                                    >
                                        {copied ? "Copied!" : "Copy"}
                                    </Button>
                                    <Button
                                        appearance="primary"
                                        icon={<ArrowDownload24Regular />}
                                        onClick={handleDownload}
                                        aria-label="Download export file"
                                    >
                                        Download
                                    </Button>
                                </>
                            )}
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="subtle">Close</Button>
                            </DialogTrigger>
                        </div>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default PromptExport;
