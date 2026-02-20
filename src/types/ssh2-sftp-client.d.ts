declare module 'ssh2-sftp-client' {
  export interface SftpListItem {
    type: string;
    name: string;
    size: number;
    modifyTime: number;
  }

  export interface SftpConnectOptions {
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
    retries?: number;
  }

  export interface SftpFastGetOptions {
    concurrency?: number;
    chunkSize?: number;
  }

  class SftpClient {
    connect(options: SftpConnectOptions): Promise<void>;
    end(): Promise<void>;
    list(path?: string): Promise<SftpListItem[]>;
    fastGet(remotePath: string, localPath: string, options?: SftpFastGetOptions): Promise<void>;
    delete(remotePath: string): Promise<void>;
  }

  export default SftpClient;
}
