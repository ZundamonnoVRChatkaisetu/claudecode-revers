// Hooks utilities for notification-system.js

export function getBaseHookData() {
    return {
        timestamp: new Date().toISOString(),
        session_id: 'session_' + Date.now()
    };
}

export async function executeHooks(hookData) {
    // Stub implementation - in real app would execute configured hooks
    console.log('[HOOKS] Executing hooks with data:', hookData);
}