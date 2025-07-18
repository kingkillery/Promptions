import React from "react";
import { makeStyles, tokens, Textarea, Button, MessageBar, Spinner } from "@fluentui/react-components";
import { ImageEdit24Regular, Sparkle24Regular, DismissCircle24Regular, Info16Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    container: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
    },
    textarea: {
        minHeight: "120px",
        fontFamily: tokens.fontFamilyBase,
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
    },
    buttonContainer: {
        display: "flex",
        gap: tokens.spacingHorizontalM,
    },
    button: {
        flex: 1,
    },
    errorMessage: {
        marginTop: tokens.spacingVerticalS,
        textWrap: "wrap",
        padding: tokens.spacingVerticalS,
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

interface ImageInputProps {
    prompt: string;
    onPromptChange: (prompt: string) => void;
    onElaborate: () => void;
    onGenerate: () => void;
    onCancelElaborate?: () => void;
    onCancelGenerate?: () => void;
    elaborateLoading: boolean;
    generateLoading: boolean;
    error?: string;
}

export const ImageInput: React.FC<ImageInputProps> = ({
    prompt,
    onPromptChange,
    onElaborate,
    onGenerate,
    onCancelElaborate,
    onCancelGenerate,
    elaborateLoading,
    generateLoading,
    error,
}) => {
    const styles = useStyles();

    const isDisabled = elaborateLoading || generateLoading;

    return (
        <div className={styles.container}>
            <Textarea
                className={styles.textarea}
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(_, data) => onPromptChange(data.value)}
                disabled={isDisabled}
                resize="vertical"
            />

            <div className={styles.disclaimerText}>
                <Info16Regular />
                AI generated responses should be verified before taking action.
            </div>

            <div className={styles.buttonContainer}>
                {elaborateLoading && onCancelElaborate ? (
                    <Button
                        className={styles.button}
                        appearance="secondary"
                        icon={<DismissCircle24Regular />}
                        onClick={onCancelElaborate}
                    >
                        Cancel
                    </Button>
                ) : (
                    <Button
                        className={styles.button}
                        appearance="secondary"
                        icon={elaborateLoading ? <Spinner size="tiny" /> : <Sparkle24Regular />}
                        onClick={onElaborate}
                        disabled={isDisabled || !prompt.trim()}
                    >
                        {elaborateLoading ? "Elaborating..." : "Elaborate"}
                    </Button>
                )}

                {generateLoading && onCancelGenerate ? (
                    <Button
                        className={styles.button}
                        appearance="primary"
                        icon={<DismissCircle24Regular />}
                        onClick={onCancelGenerate}
                    >
                        Cancel
                    </Button>
                ) : (
                    <Button
                        className={styles.button}
                        appearance="primary"
                        icon={generateLoading ? <Spinner size="tiny" /> : <ImageEdit24Regular />}
                        onClick={onGenerate}
                        disabled={isDisabled || !prompt.trim()}
                    >
                        {generateLoading ? "Generating..." : "Generate"}
                    </Button>
                )}
            </div>

            {error && (
                <MessageBar className={styles.errorMessage} intent="error">
                    {error}
                </MessageBar>
            )}
        </div>
    );
};
