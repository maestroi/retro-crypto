import { describe, it, expect } from 'vitest';
import {
  sha256,
  bytesToHex,
  hexToBytes,
  splitIntoChunks,
  concatBytes,
  verifySHA256,
  formatBytes,
  batch,
} from '../src/utils.js';

describe('Utility Functions', () => {
  describe('sha256', () => {
    it('should compute correct SHA256 hash', async () => {
      // Test vector: sha256("hello") = 2cf24dba...
      const data = new TextEncoder().encode('hello');
      const hash = await sha256(data);
      
      expect(hash.length).toBe(32);
      expect(bytesToHex(hash)).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
      );
    });

    it('should compute correct hash for empty input', async () => {
      const data = new Uint8Array(0);
      const hash = await sha256(data);
      
      // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      expect(bytesToHex(hash)).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });

    it('should be deterministic', async () => {
      const data = new TextEncoder().encode('test data');
      const hash1 = await sha256(data);
      const hash2 = await sha256(data);
      
      expect(bytesToHex(hash1)).toBe(bytesToHex(hash2));
    });
  });

  describe('bytesToHex / hexToBytes', () => {
    it('should convert bytes to hex', () => {
      const bytes = new Uint8Array([0, 1, 255, 128, 64]);
      const hex = bytesToHex(bytes);
      expect(hex).toBe('0001ff8040');
    });

    it('should convert hex to bytes', () => {
      const hex = '0001ff8040';
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([0, 1, 255, 128, 64]));
    });

    it('should handle 0x prefix', () => {
      const hex = '0x0001ff8040';
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([0, 1, 255, 128, 64]));
    });

    it('should be reversible', () => {
      const original = new Uint8Array([10, 20, 30, 40, 50]);
      const hex = bytesToHex(original);
      const restored = hexToBytes(hex);
      expect(restored).toEqual(original);
    });

    it('should throw for invalid hex length', () => {
      expect(() => hexToBytes('abc')).toThrow();
    });

    it('should handle empty input', () => {
      expect(bytesToHex(new Uint8Array(0))).toBe('');
      expect(hexToBytes('')).toEqual(new Uint8Array(0));
    });
  });

  describe('splitIntoChunks', () => {
    it('should split data into equal chunks', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const chunks = splitIntoChunks(data, 2);
      
      expect(chunks.length).toBe(5);
      expect(chunks[0]).toEqual(new Uint8Array([1, 2]));
      expect(chunks[4]).toEqual(new Uint8Array([9, 10]));
    });

    it('should handle uneven splits', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const chunks = splitIntoChunks(data, 2);
      
      expect(chunks.length).toBe(3);
      expect(chunks[2]).toEqual(new Uint8Array([5]));
    });

    it('should handle chunk size larger than data', () => {
      const data = new Uint8Array([1, 2, 3]);
      const chunks = splitIntoChunks(data, 10);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toEqual(data);
    });

    it('should handle empty data', () => {
      const data = new Uint8Array(0);
      const chunks = splitIntoChunks(data, 10);
      
      expect(chunks.length).toBe(0);
    });
  });

  describe('concatBytes', () => {
    it('should concatenate multiple arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5, 6]);
      
      const result = concatBytes(a, b, c);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it('should handle empty arrays', () => {
      const a = new Uint8Array([1, 2]);
      const empty = new Uint8Array(0);
      const b = new Uint8Array([3, 4]);
      
      const result = concatBytes(a, empty, b);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('should handle single array', () => {
      const a = new Uint8Array([1, 2, 3]);
      const result = concatBytes(a);
      expect(result).toEqual(a);
    });

    it('should handle no arrays', () => {
      const result = concatBytes();
      expect(result).toEqual(new Uint8Array(0));
    });
  });

  describe('verifySHA256', () => {
    it('should verify correct hash', async () => {
      const data = new TextEncoder().encode('hello');
      const hash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
      
      const isValid = await verifySHA256(data, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect hash', async () => {
      const data = new TextEncoder().encode('hello');
      const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';
      
      const isValid = await verifySHA256(data, wrongHash);
      expect(isValid).toBe(false);
    });

    it('should accept hash as Uint8Array', async () => {
      const data = new TextEncoder().encode('hello');
      const hash = hexToBytes('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
      
      const isValid = await verifySHA256(data, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.00 MB');
      expect(formatBytes(5242880)).toBe('5.00 MB');
    });
  });

  describe('batch', () => {
    it('should batch array into groups', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batches = batch(arr, 3);
      
      expect(batches.length).toBe(4);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7, 8, 9]);
      expect(batches[3]).toEqual([10]);
    });

    it('should handle empty array', () => {
      const batches = batch([], 5);
      expect(batches.length).toBe(0);
    });

    it('should handle batch size larger than array', () => {
      const arr = [1, 2, 3];
      const batches = batch(arr, 10);
      
      expect(batches.length).toBe(1);
      expect(batches[0]).toEqual([1, 2, 3]);
    });
  });
});

describe('Chunk Reconstruction', () => {
  it('should correctly reconstruct data from chunks', () => {
    // Simulate creating a cartridge
    const originalData = new Uint8Array(1000);
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }
    
    const chunkSize = 128;
    const chunks = splitIntoChunks(originalData, chunkSize);
    
    // Verify chunk count
    const expectedChunks = Math.ceil(originalData.length / chunkSize);
    expect(chunks.length).toBe(expectedChunks);
    
    // Reconstruct
    const reconstructed = concatBytes(...chunks);
    
    // Verify
    expect(reconstructed.length).toBe(originalData.length);
    expect(reconstructed).toEqual(originalData);
  });

  it('should handle exact chunk boundary', () => {
    const chunkSize = 128;
    const originalData = new Uint8Array(chunkSize * 3); // Exactly 3 chunks
    for (let i = 0; i < originalData.length; i++) {
      originalData[i] = i % 256;
    }
    
    const chunks = splitIntoChunks(originalData, chunkSize);
    expect(chunks.length).toBe(3);
    
    // All chunks should be exactly chunkSize
    for (const chunk of chunks) {
      expect(chunk.length).toBe(chunkSize);
    }
    
    const reconstructed = concatBytes(...chunks);
    expect(reconstructed).toEqual(originalData);
  });

  it('should verify hash after reconstruction', async () => {
    const originalData = new TextEncoder().encode('This is test cartridge data!');
    const originalHash = await sha256(originalData);
    
    const chunks = splitIntoChunks(originalData, 10);
    const reconstructed = concatBytes(...chunks);
    
    const isValid = await verifySHA256(reconstructed, originalHash);
    expect(isValid).toBe(true);
  });
});

