import React, { useState } from "react";
import {
    makeStyles,
    tokens,
    Card,
    CardHeader,
    Input,
    Button,
    Text,
    Spinner,
} from "@fluentui/react-components";
import { PersonRegular, LockClosedRegular } from "@fluentui/react-icons";
import { useAuth } from "../auth/AuthContext";

const useStyles = makeStyles({
    container: {
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.colorNeutralBackground2,
    },
    card: {
        width: "100%",
        maxWidth: "400px",
        padding: tokens.spacingVerticalXXL,
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
    },
    title: {
        textAlign: "center",
        marginBottom: tokens.spacingVerticalL,
    },
    inputWrapper: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        textAlign: "center",
    },
    button: {
        marginTop: tokens.spacingVerticalM,
    },
});

export function Login() {
    const styles = useStyles();
    const { login, error, isLoading } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) return;

        setIsSubmitting(true);
        await login(username, password);
        setIsSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <Spinner size="large" label="Loading..." />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Card className={styles.card}>
                <CardHeader
                    header={
                        <Text size={600} weight="semibold" className={styles.title}>
                            Promptions Image
                        </Text>
                    }
                />
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputWrapper}>
                        <Text weight="medium">Username</Text>
                        <Input
                            type="text"
                            value={username}
                            onChange={(_, data) => setUsername(data.value)}
                            contentBefore={<PersonRegular />}
                            placeholder="Enter username"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className={styles.inputWrapper}>
                        <Text weight="medium">Password</Text>
                        <Input
                            type="password"
                            value={password}
                            onChange={(_, data) => setPassword(data.value)}
                            contentBefore={<LockClosedRegular />}
                            placeholder="Enter password"
                            disabled={isSubmitting}
                        />
                    </div>
                    {error && (
                        <Text className={styles.error}>{error}</Text>
                    )}
                    <Button
                        appearance="primary"
                        type="submit"
                        className={styles.button}
                        disabled={isSubmitting || !username || !password}
                    >
                        {isSubmitting ? <Spinner size="tiny" /> : "Sign In"}
                    </Button>
                </form>
            </Card>
        </div>
    );
}
