// React hooks module stub
export function getReactHooks() {
    return {
        useState: (initial) => {
            let state = initial;
            const setState = (newState) => {
                if (typeof newState === 'function') {
                    state = newState(state);
                } else {
                    state = newState;
                }
            };
            return [state, setState];
        },
        useCallback: (callback, deps) => callback,
        useEffect: (effect, deps) => {
            if (typeof effect === 'function') {
                effect();
            }
        },
        useMemo: (factory, deps) => factory(),
        useRef: (initial) => ({ current: initial }),
        useContext: (context) => context
    };
}