import React from "react";
import { makeStyles, tokens, Text, Spinner, Card, CardHeader } from "@fluentui/react-components";
import { OptionRenderer, Options } from "@promptions-redux/promptions-ui";

const useStyles = makeStyles({
    container: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    card: {
        padding: tokens.spacingHorizontalM,
    },
    header: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        marginBottom: tokens.spacingVerticalS,
    },
    loadingContainer: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        padding: tokens.spacingVerticalM,
        justifyContent: "center",
    },
    loadingText: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
    emptyText: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        textAlign: "center",
        padding: tokens.spacingVerticalL,
        fontStyle: "italic",
    },
});

interface OptionsPanelProps {
    options: Options;
    optionsRenderer: OptionRenderer;
    onOptionsChange: (options: Options) => void;
    loading: boolean;
}

export const OptionsPanel: React.FC<OptionsPanelProps> = ({
    options,
    optionsRenderer: OptionsRenderer,
    onOptionsChange,
    loading,
}) => {
    const styles = useStyles();

    return (
        <div className={styles.container}>
            <Card className={styles.card}>
                <CardHeader>
                    <Text className={styles.header}>Options</Text>
                </CardHeader>

                {!loading && options.isEmpty() && (
                    <Text className={styles.emptyText}>
                        Click "Elaborate" to generate interactive options for your prompt
                    </Text>
                )}

                {loading && options.isEmpty() && (
                    <div className={styles.loadingContainer}>
                        <Spinner size="small" />
                        <Text className={styles.loadingText}>Generating options...</Text>
                    </div>
                )}

                {!options.isEmpty() && <OptionsRenderer options={options} set={onOptionsChange} />}
            </Card>
        </div>
    );
};
