/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

import axios from 'axios';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.axios = axios;
window.Pusher = Pusher;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const realtime = window.FiveBucket?.realtime ?? {};

if (realtime.enabled && realtime.key) {
    const browserScheme = window.location.protocol.replace(':', '');
    const scheme = realtime.scheme || browserScheme;
    const forceTLS = scheme === 'https';
    const port = Number(realtime.port || window.location.port || (forceTLS ? 443 : 80));

    window.Echo = new Echo({
        broadcaster: 'pusher',
        key: realtime.key,
        cluster: realtime.cluster || 'mt1',
        wsHost: realtime.host || window.location.hostname,
        wsPort: port,
        wssPort: port,
        forceTLS,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
    });
}
