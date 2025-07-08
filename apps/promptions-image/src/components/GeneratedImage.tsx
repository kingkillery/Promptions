import React from "react";
import {
    makeStyles,
    tokens,
    Spinner,
    Text,
    Card,
    CardHeader,
    CardPreview,
    Button,
    CardFooter,
} from "@fluentui/react-components";
import { ImageMultiple24Regular, ArrowDownload24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
    },
    loadingContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.spacingVerticalL,
    },
    loadingText: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
    },
    emptyContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: tokens.spacingVerticalL,
        padding: tokens.spacingHorizontalXXL,
        textAlign: "center",
    },
    emptyIcon: {
        fontSize: "48px",
        color: tokens.colorNeutralForeground3,
    },
    emptyText: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
    },
    imageCard: {
        maxWidth: "100%",
        maxHeight: "100%",
        width: "fit-content",
        height: "fit-content",
    },
    image: {
        maxWidth: "100%",
        maxHeight: "70vh",
        objectFit: "contain",
        borderRadius: tokens.borderRadiusMedium,
    },
    imageMetadata: {
        marginTop: tokens.spacingVerticalS,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        fontStyle: "italic",
    },
    downloadButton: {
        marginTop: tokens.spacingVerticalS,
    },
});

interface GeneratedImageProps {
    imageUrl?: string;
    loading: boolean;
    prompt: string;
}

export const GeneratedImage: React.FC<GeneratedImageProps> = ({ imageUrl, loading, prompt }) => {
    const styles = useStyles();

    const handleDownload = () => {
        if (!imageUrl) return;

        // Create a filename based on the prompt (sanitized)
        const sanitizedPrompt = prompt
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .replace(/\s+/g, "_")
            .substring(0, 50);
        const filename = `generated_image_${sanitizedPrompt || "untitled"}.png`;

        // Create a link element and trigger download
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <Spinner size="large" />
                    <Text className={styles.loadingText}>Generating your image...</Text>
                </div>
            </div>
        );
    }

    if (!imageUrl) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyContainer}>
                    <ImageMultiple24Regular className={styles.emptyIcon} />
                    <Text className={styles.emptyText}>Enter a prompt and click "Generate" to create an image</Text>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Card className={styles.imageCard}>
                <CardPreview>
                    <img
                        src={imageUrl}
                        alt={prompt}
                        className={styles.image}
                        onError={(e) => {
                            console.error("Image failed to load:", e);
                        }}
                    />
                </CardPreview>
                <CardHeader>
                    <Text className={styles.imageMetadata}>Generated from: "{prompt}"</Text>
                </CardHeader>
                <CardFooter>
                    <Button
                        appearance="primary"
                        icon={<ArrowDownload24Regular />}
                        onClick={handleDownload}
                        className={styles.downloadButton}
                    >
                        Download Image
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
