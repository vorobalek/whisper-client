# Whisper Messenger

[`whisper-app`](./packages/whisper-app/) is a demonstration of the Whisper protocol in action. Try it live:
[https://whisper.vorobalek.dev](https://whisper.vorobalek.dev)

> This app showcases the capabilities of the Whisper protocol. Below you'll find a detailed protocol description and
> usage examples for integration into your own projects.

---

## ✨ Features

-   ***Multiple dialogs*** (multi-peer support)
-   ***Replies***
-   ***Emoji reactions***
-   ***Typing indication***
-   ***Message status indicators*** (sent / delivered / read)
-   ***Push notifications*** (with user consent)
-   ***Encrypted local storage*** (password-protected, never leaves your device)
-   ***End-to-end encrypted WebRTC data channels***
-   ***QR code sharing and scanning*** for public keys
-   ***Version update notifications***
-   ***Full transparency of protocol and cryptography*** (see privacy info popup)
-   ***Full test coverage and source code are available***
-   ***No registration or disclosure of any personal data required***
-   ***Dual peer-to-peer channels*** (incoming/outgoing) for enhanced reliability and to circumvent regional restrictions
-   ***Seamless fallback to relay servers*** when direct P2P connection is not possible
-   ***Zero trust required*** — neither backend servers, relay servers, nor counterparties can compromise message confidentiality; security is enforced at the protocol level
-   ***Private messages are unlinkable*** — it is impossible to determine the sender or recipient, and transmitted messages contain no identifying marks

---

## 🗺️ Roadmap

Planned features (all to be implemented without compromising the core privacy and security principles):

-   **Group chats** (protocol-level, based on MLS)
-   **Voice messages**
-   **Audio/video calls**

> All future features will also preserve:
>
> -   Minimal trust in the server or other participants
> -   Minimal information stored on the server or transmitted in unencrypted form

---

## 🛡️ Overview

**Whisper** is a privacy-first, end-to-end encrypted messenger protocol and reference application. All cryptographic
operations are performed client-side, ensuring that your private data and keys never leave your device unencrypted. The
protocol is designed for **maximum privacy, security, and user control**.

> **Key Privacy Guarantees:**
>
> -   All data transfers are time-sensitive, signed, and verified by both server and recipient.
> -   Private messages use end-to-end encryption with a unique key refreshed on each reconnection.
> -   Chat history and your private signature key are stored encrypted, protected by your password, and never leave your device.
> -   All WebRTC data is transmitted with end-to-end encryption.
> -   The Whisper server only stores your public signature key and, if you consent, your push subscription. It relays data without retention or modification.
> -   All communication with the server is over HTTPS.
> -   **No registration, no personal data collection, and no trust required — privacy and unlinkability are enforced by design.**

> See the [Whisper Protocol Diagram (SVG)](docs/Whisper%20Proto.svg) for a technical overview.

---

## 🔬 Protocol Description

The protocol, implemented in [`whisper-core`](./packages/whisper-core/), provides:

-   **Key Generation**: Each user generates a signing key pair (for authentication and integrity) — this is your persistent identity and "account." Encryption key pairs, in contrast, are generated for every new connection or reconnection to a peer, ensuring that end-to-end encryption keys are always fresh and never reused.
-   **Registration**: Users register their public signing key and (optionally) push subscription with the server. All registration data is signed and time-sensitive.
-   **Connection Establishment**: Peer-to-peer connections are established using WebRTC, with signaling and authentication handled via the server. All signaling messages are also signed and time-sensitive.
-   **End-to-End Encryption**: Each session uses a unique, ephemeral encryption key derived via Diffie-Hellman, never stored or transmitted.
-   **Message Exchange**: All messages are encrypted and signed. The server only relays encrypted payloads and never has the ability to modify, or inspect this content.
-   **Push Notifications**: Optional push notifications are supported via VAPID and Web Push, with subscriptions stored only if the user consents.

---

## 🚀 Getting Started & Usage Example

### [Minimal Integration](docs/example.min.html)

```html
<!-- docs/example.min.html -->
<!doctype html>
<html lang="en">
    <head></head>
    <body></body>
    <script>
        (function (w, h, s, p, r, m, i, n) {
            if (w[p]) return;
            m = 1 * new Date();
            w[p] = {};
            w[p].t = m;
            r = h.getElementsByTagName(s)[0];
            i = h.createElement(s);
            i.async = true;
            i.src = 'https://whisper.vorobalek.dev/core.min.js?_=' + m;
            i.onload = function () {
                n = Whisper.getPrototype(console);
                n.initialize({
                    serverUrl: 'https://cluster.vorobalek.dev/whisper',
                    signingKeyPair: n.generateSigningKeyPair(),
                }).then((x) => {
                    w[p] = x;
                });
            };
            r.parentNode.insertBefore(i, r);
        })(window, document, 'script', 'whisper');
    </script>
</html>
```

### [Full Integration](docs/example.html)

```html
<!-- docs/example.html -->
<!doctype html>
<html lang="en">
    <head></head>
    <body></body>
    <script>
        (function (w, h, s, p, r, m, i, n) {
            if (w[p]) return;
            m = 1 * new Date();
            w[p] = {};
            w[p].t = m;
            r = h.getElementsByTagName(s)[0];
            i = h.createElement(s);
            i.async = true;
            i.src = 'https://whisper.vorobalek.dev/core.min.js?_=' + m;
            i.onload = function () {
                n = Whisper.getPrototype(console);
                n.initialize({
                    onMayWorkUnstably: (reason) => {
                        console.warn(reason);
                    },
                    onTrace: (...args) => {
                        console.trace(...args);
                    },
                    onDebug: (...args) => {
                        console.debug(...args);
                    },
                    onLog: (...args) => {
                        console.log(...args);
                    },
                    onWarn: (...args) => {
                        console.warn(...args);
                    },
                    onError: (...args) => {
                        console.error(...args);
                    },
                    serverUrl: 'https://cluster.vorobalek.dev/whisper',
                    version: `${m}`,
                    onNewVersion: () => {
                        console.warn('Update needed!');
                    },
                    vapidKey: 'BHAYDRAjMWXfg7dxFIOZYNLlxrVDohy_PbN7SXcrXapiZq0Jnt0VXsAx6ytkLArVVFDSfula4VRWm5HDvkVVRbA',
                    onPermissionDefault: () => {
                        console.warn('Permissions default!');
                    },
                    onPermissionGranted: () => {
                        console.warn('Permissions granted!');
                    },
                    onPermissionDenied: () => {
                        console.warn('Permissions denied!');
                    },
                    signingKeyPair: n.generateSigningKeyPair(),
                    onIncomingConnection: (connection) => console.warn('Incoming connection', connection),
                    iceServers: [
                        {
                            urls: 'stun:coturn.sfo3.do.vorobalek.dev:3478',
                        },
                        {
                            urls: 'stun:coturn.ams3.do.vorobalek.dev:3478',
                        },
                        {
                            urls: 'stun:coturn.fra1.do.vorobalek.dev:3478',
                        },
                        {
                            urls: 'turn:coturn.sfo3.do.vorobalek.dev:3478',
                            username: 'anonymous',
                            credential: 'anonymous',
                        },
                        {
                            urls: 'turn:coturn.ams3.do.vorobalek.dev:3478',
                            username: 'anonymous',
                            credential: 'anonymous',
                        },
                        {
                            urls: 'turn:coturn.fra1.do.vorobalek.dev:3478',
                            username: 'anonymous',
                            credential: 'anonymous',
                        },
                    ],
                    focusOnDial: (peerPublicKey) => {
                        console.warn('Dial!', peerPublicKey);
                        return Promise.resolve(true);
                    },
                    requestDial: (peerPublicKey) => {
                        if (window.confirm(`Incoming connection request from ${peerPublicKey}.\nAccept?`)) {
                            return Promise.resolve(true);
                        }
                        console.warn('Declined.', peerPublicKey);
                        return Promise.resolve(false);
                    },
                }).then((x) => {
                    w[p] = x;
                });
            };
            r.parentNode.insertBefore(i, r);
        })(window, document, 'script', 'whisper');
    </script>
</html>
```

### Using the Library from the Browser Console

After integration, you can interact with the protocol directly from the browser console:

```js
// 1. Get your public key
whisper.publicKey;

// 2. Set up a message handler for a peer (replace <peer public key> with the actual key)
whisper.get('<peer public key>').onMessage = (e) => {
    console.warn(e);
};

// 3. Open a connection to the peer
whisper.get('<peer public key>').open();

// 4. Send a message to the peer
whisper.get('<peer public key>').send('Hello, Whisper!');
```

---

## 🧪 Test Coverage & Source Code

-   [View coverage and source code online](https://whisper.vorobalek.dev/coverage)
