// Ambient types for `file-saver`. The published `file-saver@2.x` ships no
// bundled typings, so this minimal declaration replaces the removed
// `@types/file-saver` dependency (IES-P2-12). Kept in sync with the package's
// public API: `saveAs(data, filename?, options?)`.
declare module 'file-saver' {
  export interface FileSaverOptions {
    autoBom?: boolean;
  }
  export function saveAs(data: Blob | File | string, filename?: string, options?: FileSaverOptions): void;
}
