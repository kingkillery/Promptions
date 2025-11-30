import React from "react";
import { ResponseMessage } from "../types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Card, Skeleton, SkeletonItem, makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
    messageContainer: {
        display: "flex",
        justifyContent: "flex-start",
        marginBottom: tokens.spacingVerticalM,
    },
    messageCard: {
        maxWidth: "100%",
        minWidth: "100%",
        backgroundColor: "transparent",
        color: tokens.colorNeutralForeground1,
        padding: tokens.spacingVerticalM,
        border: "none",
        boxShadow: "none",
    },
    messageContent: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
    },
    thinkingContainer: {
        width: "80%",
    },
});

interface AssistantMessageProps {
    message: ResponseMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
    const styles = useStyles();

    // Generate random widths for skeleton items
    const generateRandomWidth = () => Math.floor(Math.random() * 40) + 50; // 50-90%
    const skeletonWidths = React.useMemo(
        () => [`${generateRandomWidth()}%`, `${generateRandomWidth()}%`, `${generateRandomWidth()}%`],
        [],
    );

    return (
        <div className={styles.messageContainer} role="article" aria-label="AI assistant response">
            <Card className={styles.messageCard}>
                {/* Render markdown content */}
                {message.content || !message.contentDone ? (
                    message.content ? (
                        <div className={styles.messageContent}>
                            <MarkdownRenderer content={message.content} />
                        </div>
                    ) : (
                        <div className={styles.thinkingContainer} aria-busy="true">
                            <Skeleton
                                style={{ display: "flex", flexDirection: "column", gap: "5px" }}
                                aria-label="Loading response"
                            >
                                <SkeletonItem style={{ width: skeletonWidths[0] }} aria-hidden="true" />
                                <SkeletonItem style={{ width: skeletonWidths[1] }} aria-hidden="true" />
                                <SkeletonItem style={{ width: skeletonWidths[2] }} aria-hidden="true" />
                            </Skeleton>
                        </div>
                    )
                ) : null}
            </Card>
        </div>
    );
};
