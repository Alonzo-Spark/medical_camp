// Build the mobile-upload URL encoded into the QR code.
// In local dev the desktop runs on localhost, so the phone must reach the dev
// server via the machine's LAN IP. When deployed (Vercel), the phone and
// desktop share the same public origin.
export const mobileUploadUrl = (sessionId, serverIp) => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return `http://${serverIp}:5173/mobile-upload/${sessionId}`;
    }
    return `${window.location.origin}/mobile-upload/${sessionId}`;
};
