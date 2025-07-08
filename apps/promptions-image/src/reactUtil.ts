import React from "react";

export function useMounted(): { readonly isMounted: boolean } {
    const state = React.useRef<{
        isMounted: boolean;
        mountId: object | undefined;
    }>({
        get isMounted() {
            return this.mountId !== undefined;
        },
        mountId: undefined,
    });
    React.useEffect(() => {
        const obj = state.current;
        const mountId = {};
        obj.mountId = mountId;
        return () => {
            if (obj.mountId === mountId) {
                obj.mountId = undefined;
            }
        };
    }, []);
    const obj = state.current;
    if (obj.mountId === undefined) {
        obj.mountId = {};
    }
    return obj;
}
