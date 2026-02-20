import { SftpService } from '../../../src/services/sftp.service';
import { SftpError } from '../../../src/utils/errors';
import SftpClient from 'ssh2-sftp-client';

// Mock ssh2-sftp-client
jest.mock('ssh2-sftp-client');

describe('SftpService', () => {
  let sftpService: SftpService;
  let mockClient: jest.Mocked<SftpClient>;

  const mockConfig = {
    host: 'test.sftp.com',
    port: 22,
    username: 'testuser',
    password: 'testpass',
    remotePath: '/test',
  };

  const retryOptions = {
    maxRetries: 2,
    delayMs: 100,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new SftpClient() as jest.Mocked<SftpClient>;
    sftpService = new SftpService(mockConfig, retryOptions);
    
    // Replace the internal client with our mock
    (sftpService as any).client = mockClient;
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      mockClient.connect = jest.fn().mockResolvedValue(undefined);

      await sftpService.connect();

      expect(mockClient.connect).toHaveBeenCalledWith({
        host: mockConfig.host,
        port: mockConfig.port,
        username: mockConfig.username,
        password: mockConfig.password,
        readyTimeout: 30000,
        retries: 0,
      });
      expect(sftpService.isClientConnected()).toBe(true);
    });

    it('should throw SftpError on connection failure', async () => {
      mockClient.connect = jest.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(sftpService.connect()).rejects.toThrow(SftpError);
    });

    it('should detect authentication errors', async () => {
      mockClient.connect = jest
        .fn()
        .mockRejectedValue(new Error('All configured authentication methods failed'));

      await expect(sftpService.connect()).rejects.toThrow(SftpError);
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const mockFileList = [
        { type: '-', name: 'file1.wav', size: 1000, modifyTime: 1234567890 },
        { type: '-', name: 'file2.mp3', size: 2000, modifyTime: 1234567891 },
        { type: 'd', name: 'directory', size: 0, modifyTime: 1234567892 },
      ];

      mockClient.list = jest.fn().mockResolvedValue(mockFileList);

      const files = await sftpService.listFiles();

      expect(files).toHaveLength(2); // Only files, not directory
      expect(files[0]).toEqual({
        name: 'file1.wav',
        size: 1000,
        modifyTime: 1234567890,
        remotePath: '/test/file1.wav',
      });
    });

    it('should throw SftpError on list failure', async () => {
      mockClient.list = jest.fn().mockRejectedValue(new Error('List failed'));

      await expect(sftpService.listFiles()).rejects.toThrow(SftpError);
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      mockClient.fastGet = jest.fn().mockResolvedValue(undefined);

      await sftpService.downloadFile('/remote/file.wav', '/local/file.wav');

      expect(mockClient.fastGet).toHaveBeenCalledWith('/remote/file.wav', '/local/file.wav', {
        concurrency: 64,
        chunkSize: 32768,
      });
    });

    it('should throw SftpError on download failure', async () => {
      mockClient.fastGet = jest.fn().mockRejectedValue(new Error('Download failed'));

      await expect(sftpService.downloadFile('/remote/file.wav', '/local/file.wav')).rejects.toThrow(
        SftpError
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      (sftpService as any).isConnected = true;
      mockClient.end = jest.fn().mockResolvedValue(undefined);

      await sftpService.disconnect();

      expect(mockClient.end).toHaveBeenCalled();
      expect(sftpService.isClientConnected()).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      (sftpService as any).isConnected = true;
      mockClient.list = jest.fn().mockResolvedValue([]);

      const result = await sftpService.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      (sftpService as any).isConnected = true;
      mockClient.list = jest.fn().mockRejectedValue(new Error('Connection lost'));

      const result = await sftpService.healthCheck();

      expect(result).toBe(false);
    });
  });
});
