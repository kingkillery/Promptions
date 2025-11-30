import React from "react";
import {
    Card,
    Button,
    makeStyles,
    tokens,
    Text,
} from "@fluentui/react-components";
import { ErrorCircle24Regular, ArrowClockwise24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "200px",
        padding: tokens.spacingHorizontalXL,
    },
    card: {
        maxWidth: "500px",
        padding: tokens.spacingHorizontalL,
        textAlign: "center",
    },
    icon: {
        fontSize: "48px",
        color: tokens.colorPaletteRedForeground1,
        marginBottom: tokens.spacingVerticalM,
    },
    title: {
        fontSize: tokens.fontSizeBase500,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalS,
    },
    message: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
        marginBottom: tokens.spacingVerticalL,
    },
    details: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        backgroundColor: tokens.colorNeutralBackground3,
        padding: tokens.spacingHorizontalM,
        borderRadius: tokens.borderRadiusMedium,
        marginBottom: tokens.spacingVerticalM,
        fontFamily: "monospace",
        textAlign: "left",
        maxHeight: "150px",
        overflow: "auto",
        width: "100%",
    },
    buttonGroup: {
        display: "flex",
        gap: tokens.spacingHorizontalM,
        justifyContent: "center",
    },
});

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI.
 * 
 * @example
 * <ErrorBoundary onError={(error) => logToService(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        this.setState({ errorInfo });
        
        // Log error to console in development
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        
        // Call optional error handler
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return <ErrorFallback 
                error={this.state.error} 
                onRetry={this.handleRetry}
                onReload={this.handleReload}
            />;
        }

        return this.props.children;
    }
}

interface ErrorFallbackProps {
    error: Error | null;
    onRetry: () => void;
    onReload: () => void;
}

/**
 * Default error fallback UI component with retry and reload options.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry, onReload }) => {
    const styles = useStyles();
    const [showDetails, setShowDetails] = React.useState(false);

    return (
        <div 
            className={styles.container}
            role="alert"
            aria-live="assertive"
            aria-labelledby="error-title"
            aria-describedby="error-message"
        >
            <Card className={styles.card}>
                <ErrorCircle24Regular 
                    className={styles.icon} 
                    aria-hidden="true"
                />
                <Text 
                    id="error-title"
                    className={styles.title} 
                    as="h2"
                >
                    Something went wrong
                </Text>
                <Text 
                    id="error-message"
                    className={styles.message}
                >
                    An unexpected error occurred. You can try again or reload the page.
                </Text>
                
                {error && showDetails && (
                    <div 
                        className={styles.details}
                        role="region"
                        aria-label="Error details"
                    >
                        <strong>Error:</strong> {error.message}
                        {error.stack && (
                            <>
                                <br /><br />
                                <strong>Stack:</strong>
                                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                                    {error.stack}
                                </pre>
                            </>
                        )}
                    </div>
                )}

                <div className={styles.buttonGroup}>
                    <Button
                        appearance="primary"
                        icon={<ArrowClockwise24Regular />}
                        onClick={onRetry}
                        aria-label="Try again"
                    >
                        Try Again
                    </Button>
                    <Button
                        appearance="secondary"
                        onClick={onReload}
                        aria-label="Reload the page"
                    >
                        Reload Page
                    </Button>
                    {error && (
                        <Button
                            appearance="subtle"
                            onClick={() => setShowDetails(!showDetails)}
                            aria-expanded={showDetails}
                            aria-controls="error-details"
                        >
                            {showDetails ? "Hide Details" : "Show Details"}
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default ErrorBoundary;
