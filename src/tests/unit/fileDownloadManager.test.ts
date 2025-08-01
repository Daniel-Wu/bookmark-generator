import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileDownloadManager, FileUtils } from '../../modules/export/fileDownload';
import type { EnhancedDownloadConfig } from '../../modules/export/fileDownload';

// Mock DOM APIs
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockShowSaveFilePicker = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  value: mockCreateObjectURL,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
});

Object.defineProperty(window, 'showSaveFilePicker', {
  value: mockShowSaveFilePicker,
  writable: true,
});

// Mock document methods
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
});

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
});

describe('FileDownloadManager', () => {
  let downloadManager: FileDownloadManager;
  let testData: Uint8Array;

  beforeEach(() => {
    downloadManager = new FileDownloadManager();
    testData = new Uint8Array([1, 2, 3, 4, 5]);
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default mock behaviors
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
    mockCreateElement.mockReturnValue({
      href: '',
      download: '',
      style: { display: '' },
      click: mockClick,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('capabilities detection', () => {
    it('detects browser capabilities correctly', () => {
      const capabilities = downloadManager.getCapabilities();
      
      expect(capabilities).toHaveProperty('supportsDownload');
      expect(capabilities).toHaveProperty('supportsFilesystemAPI');
      expect(capabilities).toHaveProperty('maxFileSize');
      expect(capabilities).toHaveProperty('supportedMimeTypes');
      expect(Array.isArray(capabilities.supportedMimeTypes)).toBe(true);
    });

    it('sets appropriate max file size based on browser', () => {
      const capabilities = downloadManager.getCapabilities();
      expect(typeof capabilities.maxFileSize).toBe('number');
      expect(capabilities.maxFileSize).toBeGreaterThan(0);
    });
  });

  describe('basic file download', () => {
    it('downloads file using anchor method', async () => {
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
      };

      const result = await downloadManager.downloadFile(testData, config);

      expect(result).toBe(true);
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
    });

    it('handles progress callbacks', async () => {
      const onProgress = vi.fn();
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
        onProgress,
      };

      await downloadManager.downloadFile(testData, config);

      expect(onProgress).toHaveBeenCalled();
    });

    it('handles completion callbacks', async () => {
      const onComplete = vi.fn();
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
        onComplete,
      };

      await downloadManager.downloadFile(testData, config);

      expect(onComplete).toHaveBeenCalledWith(true);
    });
  });

  describe('enhanced download features', () => {
    it('retries failed downloads', async () => {
      let attemptCount = 0;
      mockCreateObjectURL.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return 'blob:mock-url';
      });

      const config: EnhancedDownloadConfig = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
        maxRetries: 3,
        retryDelay: 10, // Short delay for testing
      };

      const result = await downloadManager.downloadFileEnhanced(testData, config);

      expect(result.success).toBe(true);
      expect(result.retriesUsed).toBe(2); // Failed twice, succeeded on third
      expect(attemptCount).toBe(3);
    });

    it('calls retry callback on failed attempts', async () => {
      const onRetry = vi.fn();
      let attemptCount = 0;
      
      mockCreateObjectURL.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Network error');
        }
        return 'blob:mock-url';
      });

      const config: EnhancedDownloadConfig = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
        maxRetries: 2,
        retryDelay: 10,
        onRetry,
      };

      await downloadManager.downloadFileEnhanced(testData, config);

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('respects file size limits', async () => {
      const largeData = new Uint8Array(1024 * 1024 * 1024); // 1GB
      const config = {
        filename: 'large.stl',
        mimeType: 'application/sla',
        saveDialog: false,
      };

      const result = await downloadManager.downloadFileEnhanced(largeData, config);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('exceeds browser limit');
    });

    it('handles cancellation', async () => {
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
      };

      // Start download
      const downloadPromise = downloadManager.downloadFileEnhanced(testData, config);
      
      // Cancel immediately
      downloadManager.cancelDownload();

      const result = await downloadPromise;

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });

  describe('File System Access API', () => {
    beforeEach(() => {
      // Mock File System Access API support
      Object.defineProperty(downloadManager, 'capabilities', {
        value: {
          supportsFilesystemAPI: true,
          supportsDownload: true,
          maxFileSize: 1024 * 1024 * 1024,
          supportedMimeTypes: ['application/sla'],
        },
      });
    });

    it('uses File System Access API when available and requested', async () => {
      const mockWritable = {
        write: vi.fn(),
        close: vi.fn(),
      };

      const mockFileHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };

      mockShowSaveFilePicker.mockResolvedValue(mockFileHandle);

      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: true,
      };

      const result = await downloadManager.downloadFile(testData, config);

      expect(result).toBe(true);
      expect(mockShowSaveFilePicker).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalled();
      expect(mockWritable.close).toHaveBeenCalled();
    });

    it('handles user cancellation in File System Access API', async () => {
      mockShowSaveFilePicker.mockRejectedValue(new DOMException('User cancelled', 'AbortError'));

      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: true,
      };

      const result = await downloadManager.downloadFile(testData, config);

      expect(result).toBe(false);
    });
  });

  describe('download management', () => {
    it('tracks active downloads', async () => {
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
      };

      // Start download (don't await)
      const downloadPromise = downloadManager.downloadFileEnhanced(testData, config);
      
      const activeDownloads = downloadManager.getActiveDownloads();
      expect(activeDownloads.length).toBe(1);

      // Complete download
      await downloadPromise;

      const activeDownloadsAfter = downloadManager.getActiveDownloads();
      expect(activeDownloadsAfter.length).toBe(0);
    });

    it('maintains download history', async () => {
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
      };

      await downloadManager.downloadFileEnhanced(testData, config);

      const history = downloadManager.getDownloadHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
      expect(history[0].bytesTransferred).toBe(testData.length);
    });

    it('cancels all active downloads', () => {
      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
      };

      // Start multiple downloads
      downloadManager.downloadFileEnhanced(testData, config);
      downloadManager.downloadFileEnhanced(testData, config);

      const cancelled = downloadManager.cancelDownload();
      expect(cancelled).toBe(true);
    });
  });

  describe('file validation', () => {
    it('validates file size correctly', () => {
      const smallFile = 1024; // 1KB
      const result = downloadManager.canDownloadFile(smallFile, 'application/sla');
      
      expect(result.canDownload).toBe(true);
    });

    it('rejects files that are too large', () => {
      const largeFile = 10 * 1024 * 1024 * 1024; // 10GB
      const result = downloadManager.canDownloadFile(largeFile, 'application/sla');
      
      expect(result.canDownload).toBe(false);
      expect(result.reason).toContain('exceeds browser limit');
    });
  });

  describe('error handling', () => {
    it('handles network errors gracefully', async () => {
      mockCreateObjectURL.mockImplementation(() => {
        throw new Error('Network error');
      });

      const config = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
        maxRetries: 1,
      };

      const result = await downloadManager.downloadFileEnhanced(testData, config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('calls error callback on failures', async () => {
      const onError = vi.fn();
      
      mockCreateObjectURL.mockImplementation(() => {
        throw new Error('Test error');
      });

      const config: EnhancedDownloadConfig = {
        filename: 'test.stl',
        mimeType: 'application/sla',
        saveDialog: false,
        maxRetries: 0,
        onError,
      };

      await downloadManager.downloadFileEnhanced(testData, config);

      expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Boolean));
    });
  });
});

describe('FileUtils', () => {
  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(FileUtils.formatFileSize(512)).toBe('512B');
      expect(FileUtils.formatFileSize(1024)).toBe('1.0KB');
      expect(FileUtils.formatFileSize(1024 * 1024)).toBe('1.0MB');
      expect(FileUtils.formatFileSize(1024 * 1024 * 1024)).toBe('1.0GB');
    });

    it('handles zero and negative values', () => {
      expect(FileUtils.formatFileSize(0)).toBe('0B');
      expect(FileUtils.formatFileSize(-1)).toBe('-1B');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes invalid characters', () => {
      const filename = 'test<>:"/\\|?*file.stl';
      const sanitized = FileUtils.sanitizeFilename(filename);
      expect(sanitized).toBe('test_________file.stl');
    });

    it('handles empty filename', () => {
      const sanitized = FileUtils.sanitizeFilename('');
      expect(sanitized).toBe('');
    });

    it('removes leading dots', () => {
      const sanitized = FileUtils.sanitizeFilename('...test.stl');
      expect(sanitized).toBe('test.stl');
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('returns correct MIME types', () => {
      expect(FileUtils.getMimeTypeFromExtension('.stl')).toBe('application/sla');
      expect(FileUtils.getMimeTypeFromExtension('.3mf')).toBe('application/3mf');
      expect(FileUtils.getMimeTypeFromExtension('.unknown')).toBe('application/octet-stream');
    });

    it('handles case insensitive extensions', () => {
      expect(FileUtils.getMimeTypeFromExtension('.STL')).toBe('application/sla');
      expect(FileUtils.getMimeTypeFromExtension('.3MF')).toBe('application/3mf');
    });
  });

  describe('validateFilename', () => {
    it('validates good filenames', () => {
      const result = FileUtils.validateFilename('test.stl');
      expect(result.valid).toBe(true);
    });

    it('rejects empty filenames', () => {
      const result = FileUtils.validateFilename('');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('rejects filenames with invalid characters', () => {
      const result = FileUtils.validateFilename('test<>.stl');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('invalid characters');
    });

    it('rejects reserved names', () => {
      const result = FileUtils.validateFilename('con.stl');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('reserved name');
    });

    it('rejects too long filenames', () => {
      const longName = 'a'.repeat(300) + '.stl';
      const result = FileUtils.validateFilename(longName);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too long');
    });
  });

  describe('generateUniqueFilename', () => {
    it('returns original filename when unique', () => {
      const result = FileUtils.generateUniqueFilename('test.stl', []);
      expect(result).toBe('test.stl');
    });

    it('generates unique filename when original exists', () => {
      const result = FileUtils.generateUniqueFilename('test.stl', ['test.stl']);
      expect(result).toBe('test (1).stl');
    });

    it('handles multiple conflicts', () => {
      const existing = ['test.stl', 'test (1).stl', 'test (2).stl'];
      const result = FileUtils.generateUniqueFilename('test.stl', existing);
      expect(result).toBe('test (3).stl');
    });

    it('preserves file extension', () => {
      const result = FileUtils.generateUniqueFilename('test.3mf', ['test.3mf']);
      expect(result).toBe('test (1).3mf');
    });
  });
});