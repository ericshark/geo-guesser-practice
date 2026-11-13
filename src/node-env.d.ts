declare module 'node:fs/promises' {
  function readFile(path: string, encoding: BufferEncoding): Promise<string>;
  function writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;
  function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  function rename(oldPath: string, newPath: string): Promise<void>;
  function mkdtemp(prefix: string): Promise<string>;
  function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  function access(path: string): Promise<void>;
  function copyFile(src: string, dest: string): Promise<void>;
  const fs: {
    access: typeof access;
    copyFile: typeof copyFile;
    readFile: typeof readFile;
    writeFile: typeof writeFile;
    mkdir: typeof mkdir;
    rename: typeof rename;
    mkdtemp: typeof mkdtemp;
    rm: typeof rm;
  };
  export default fs;
}

declare module 'node:path' {
  function resolve(...paths: string[]): string;
  function join(...paths: string[]): string;
  function dirname(p: string): string;
  const path: {
    resolve: typeof resolve;
    join: typeof join;
    dirname: typeof dirname;
  };
  export default path;
}

declare module 'node:os' {
  function tmpdir(): string;
  const os: {
    tmpdir: typeof tmpdir;
  };
  export default os;
}

declare module 'node:http' {
  export interface IncomingMessage extends AsyncIterable<Uint8Array | string> {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  }
  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(data?: string): void;
  }
}

type BufferEncoding = 'utf-8' | 'utf8';

declare const process: {
  cwd(): string;
  pid: number;
  env: Record<string, string | undefined>;
};
