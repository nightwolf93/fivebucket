# FiveBucket JS/TS SDK

Official JavaScript and TypeScript SDK for FiveBucket.

Use it from Node.js tools, admin panels, browser upload flows, or FiveM server-side JavaScript resources. Do not expose a full API key in FiveM client scripts.

## Install

```bash
npm install @fivebucket/sdk
```

For local development in this repository:

```bash
cd packages/fivebucket-js
npm install
npm run build
```

## Basic Usage

```ts
import { FiveBucketClient } from '@fivebucket/sdk';

const fivebucket = new FiveBucketClient({
  baseUrl: 'https://fivebucket.nightwolf.fr',
  apiKey: process.env.FIVEBUCKET_API_KEY,
});

await fivebucket.log({
  level: 'info',
  message: 'Server started',
  resource: 'core',
  metadata: {
    server: 'prod-rp-1',
  },
});
```

## Upload Media

```ts
const file = new Blob(['hello'], { type: 'text/plain' });

const uploaded = await fivebucket.uploadFile(file, {
  filename: 'audit.txt',
  path: 'admin/commands',
  visibility: 'private',
  metadata: {
    source: 'moderation',
  },
});

console.log(uploaded.data.url);
console.log(uploaded.data.signedUrl);
```

## Image Variants

FiveBucket exposes app-delivered image variants through `/asset/{id}`.

```ts
const image = await fivebucket.getFile('01HV7AJ1KJ3W4Y9QH7N7B9XGRT');

console.log(image.data.assetUrl);
console.log(image.data.variantUrl); // /asset/{id}?w=512&q=80&format=webp
```

For private media, generate a signed URL:

```ts
const signed = await fivebucket.signedFileUrl('01HV7AJ1KJ3W4Y9QH7N7B9XGRT', {
  expires: 900,
  w: 512,
  q: 80,
  format: 'webp',
});

console.log(signed.data.signedUrl);
```

## FiveM Server JS

```js
const fivebucket = new FiveBucketClient({
  baseUrl: GetConvar('fivebucket_base_url', 'https://fivebucket.nightwolf.fr'),
  apiKey: GetConvar('fivebucket_api_key', ''),
});

RegisterCommand('admin_audit', async (source, args) => {
  await fivebucket.log({
    level: 'info',
    message: 'Admin command used',
    resource: GetCurrentResourceName(),
    metadata: {
      source,
      command: args[0],
      args,
    },
  });
}, true);
```

## API Surface

- `request(method, path, options)`
- `listFiles(query)`
- `getFile(idOrPath)`
- `deleteFile(idOrPath)`
- `signedFileUrl(idOrPath, options)`
- `uploadFile(blob, options)`
- `uploadBase64(base64, options)`
- `createPresignedUpload(options)`
- `log(entry)`
- `logs(entries)`
- `discordLog(payload)`
- `sdkReport(options)`
- `sdkHeartbeat(token)`
- `sdkInvalidate(token)`
