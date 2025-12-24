import { Button, makeStyles, tokens, Text } from "@fluentui/react-components";
import { A2UIRenderer, useA2UI } from "@promptions/promptions-ui";

const useStyles = makeStyles({
    container: {
        marginTop: tokens.spacingVerticalXL,
        padding: tokens.spacingHorizontalM,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacingHorizontalM,
        marginBottom: tokens.spacingVerticalS,
    },
    actions: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
    },
    status: {
        marginBottom: tokens.spacingVerticalS,
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    content: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
    },
});

export interface A2UIPanelProps {
    prompt?: string;
}

export function A2UIPanel({ prompt }: A2UIPanelProps) {
    const styles = useStyles();
    const { isConnected, isStreaming, rootComponents, connect, disconnect, reset, sendAction } = useA2UI();

    const status = isStreaming ? "Streaming…" : isConnected ? "Connected" : "Idle";

    return (
        <section className={styles.container} aria-label="A2UI panel">
            <div className={styles.header}>
                <Text weight="semibold">A2UI</Text>
                <div className={styles.actions}>
                    <Button
                        appearance="primary"
                        disabled={!prompt || isStreaming}
                        onClick={() => connect(prompt)}
                    >
                        Generate UI
                    </Button>
                    <Button appearance="secondary" disabled={isStreaming} onClick={reset}>
                        Reset
                    </Button>
                    <Button appearance="subtle" disabled={!isConnected && !isStreaming} onClick={disconnect}>
                        Stop
                    </Button>
                </div>
            </div>
            <div className={styles.status}>{status}</div>

            <div className={styles.content}>
                {rootComponents.length ? (
                    rootComponents.map((component) => (
                        <A2UIRenderer
                            key={component.id}
                            component={component}
                            actionCallback={sendAction}
                        />
                    ))
                ) : (
                    <Text size={200}>
                        No A2UI output yet.
                    </Text>
                )}
            </div>
        </section>
    );
}
