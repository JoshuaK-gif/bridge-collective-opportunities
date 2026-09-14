export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

/** Result of the instant new-opportunity notification returned by the API. */
export type NotificationResult = {
    sent: number;
    failed: number;
    total: number;
    skipped?: boolean;
    reason?: string;
};

/** Human-readable summary of an instant notification, for admin toasts. */
export function notifySummary(notification?: NotificationResult | null): string | undefined {
    if (!notification) return undefined;
    if (notification.skipped) return `No email sent — ${notification.reason || 'skipped'}`;
    if (!notification.sent) return 'No subscribers to email yet';
    const who = `${notification.sent} subscriber${notification.sent === 1 ? '' : 's'}`;
    return notification.failed ? `Emailed ${who} (${notification.failed} failed)` : `Emailed ${who}`;
}