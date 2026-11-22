declare module 'node:fs' {
  const fs: any;
  export default fs;
}

declare module 'node:path' {
  const path: any;
  export default path;
}

declare module '@vercel/node' {
  export type VercelRequest = any;
  export type VercelResponse = any;
}

declare const __dirname: string;
