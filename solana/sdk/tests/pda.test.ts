import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  deriveCatalogRootPDA,
  deriveCatalogPagePDA,
  deriveManifestPDA,
  deriveChunkPDA,
  deriveAllChunkPDAs,
} from '../src/pda.js';
import { PROGRAM_ID } from '../src/constants.js';
import { hexToBytes, bytesToHex } from '../src/utils.js';

describe('PDA Derivation', () => {
  // Sample cartridge ID for testing (32 bytes)
  const sampleCartridgeId = hexToBytes(
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd'
  );

  describe('deriveCatalogRootPDA', () => {
    it('should derive a valid catalog root PDA', () => {
      const [pda, bump] = deriveCatalogRootPDA(PROGRAM_ID);
      
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it('should be deterministic (same result for same inputs)', () => {
      const [pda1, bump1] = deriveCatalogRootPDA(PROGRAM_ID);
      const [pda2, bump2] = deriveCatalogRootPDA(PROGRAM_ID);
      
      expect(pda1.equals(pda2)).toBe(true);
      expect(bump1).toBe(bump2);
    });

    it('should produce different PDAs for different program IDs', () => {
      const differentProgramId = new PublicKey('11111111111111111111111111111111');
      const [pda1] = deriveCatalogRootPDA(PROGRAM_ID);
      const [pda2] = deriveCatalogRootPDA(differentProgramId);
      
      expect(pda1.equals(pda2)).toBe(false);
    });
  });

  describe('deriveCatalogPagePDA', () => {
    it('should derive valid catalog page PDAs for different indices', () => {
      for (let i = 0; i < 5; i++) {
        const [pda, bump] = deriveCatalogPagePDA(i, PROGRAM_ID);
        
        expect(pda).toBeInstanceOf(PublicKey);
        expect(bump).toBeGreaterThanOrEqual(0);
        expect(bump).toBeLessThanOrEqual(255);
      }
    });

    it('should produce different PDAs for different page indices', () => {
      const [pda0] = deriveCatalogPagePDA(0, PROGRAM_ID);
      const [pda1] = deriveCatalogPagePDA(1, PROGRAM_ID);
      const [pda100] = deriveCatalogPagePDA(100, PROGRAM_ID);
      
      expect(pda0.equals(pda1)).toBe(false);
      expect(pda0.equals(pda100)).toBe(false);
      expect(pda1.equals(pda100)).toBe(false);
    });

    it('should be deterministic', () => {
      const [pda1, bump1] = deriveCatalogPagePDA(5, PROGRAM_ID);
      const [pda2, bump2] = deriveCatalogPagePDA(5, PROGRAM_ID);
      
      expect(pda1.equals(pda2)).toBe(true);
      expect(bump1).toBe(bump2);
    });
  });

  describe('deriveManifestPDA', () => {
    it('should derive a valid manifest PDA', () => {
      const [pda, bump] = deriveManifestPDA(sampleCartridgeId, PROGRAM_ID);
      
      expect(pda).toBeInstanceOf(PublicKey);
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
    });

    it('should throw for invalid cartridge ID length', () => {
      const shortId = new Uint8Array(16);
      expect(() => deriveManifestPDA(shortId, PROGRAM_ID)).toThrow();
      
      const longId = new Uint8Array(64);
      expect(() => deriveManifestPDA(longId, PROGRAM_ID)).toThrow();
    });

    it('should produce different PDAs for different cartridge IDs', () => {
      const id1 = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
      const id2 = hexToBytes('2222222222222222222222222222222222222222222222222222222222222222');
      
      const [pda1] = deriveManifestPDA(id1, PROGRAM_ID);
      const [pda2] = deriveManifestPDA(id2, PROGRAM_ID);
      
      expect(pda1.equals(pda2)).toBe(false);
    });

    it('should accept both Uint8Array and Buffer', () => {
      const uint8Id = new Uint8Array(sampleCartridgeId);
      const bufferId = Buffer.from(sampleCartridgeId);
      
      const [pda1] = deriveManifestPDA(uint8Id, PROGRAM_ID);
      const [pda2] = deriveManifestPDA(bufferId, PROGRAM_ID);
      
      expect(pda1.equals(pda2)).toBe(true);
    });
  });

  describe('deriveChunkPDA', () => {
    it('should derive valid chunk PDAs', () => {
      for (let i = 0; i < 10; i++) {
        const [pda, bump] = deriveChunkPDA(sampleCartridgeId, i, PROGRAM_ID);
        
        expect(pda).toBeInstanceOf(PublicKey);
        expect(bump).toBeGreaterThanOrEqual(0);
        expect(bump).toBeLessThanOrEqual(255);
      }
    });

    it('should produce different PDAs for different chunk indices', () => {
      const [pda0] = deriveChunkPDA(sampleCartridgeId, 0, PROGRAM_ID);
      const [pda1] = deriveChunkPDA(sampleCartridgeId, 1, PROGRAM_ID);
      const [pda99] = deriveChunkPDA(sampleCartridgeId, 99, PROGRAM_ID);
      
      expect(pda0.equals(pda1)).toBe(false);
      expect(pda0.equals(pda99)).toBe(false);
      expect(pda1.equals(pda99)).toBe(false);
    });

    it('should produce different PDAs for different cartridge IDs', () => {
      const id1 = hexToBytes('1111111111111111111111111111111111111111111111111111111111111111');
      const id2 = hexToBytes('2222222222222222222222222222222222222222222222222222222222222222');
      
      const [pda1] = deriveChunkPDA(id1, 0, PROGRAM_ID);
      const [pda2] = deriveChunkPDA(id2, 0, PROGRAM_ID);
      
      expect(pda1.equals(pda2)).toBe(false);
    });

    it('should throw for invalid cartridge ID length', () => {
      const shortId = new Uint8Array(16);
      expect(() => deriveChunkPDA(shortId, 0, PROGRAM_ID)).toThrow();
    });
  });

  describe('deriveAllChunkPDAs', () => {
    it('should derive all chunk PDAs for a cartridge', () => {
      const numChunks = 5;
      const pdas = deriveAllChunkPDAs(sampleCartridgeId, numChunks, PROGRAM_ID);
      
      expect(pdas.length).toBe(numChunks);
      
      for (let i = 0; i < numChunks; i++) {
        const [pda, bump] = pdas[i];
        expect(pda).toBeInstanceOf(PublicKey);
        expect(bump).toBeGreaterThanOrEqual(0);
        expect(bump).toBeLessThanOrEqual(255);
      }
    });

    it('should match individual chunk PDA derivations', () => {
      const numChunks = 3;
      const allPdas = deriveAllChunkPDAs(sampleCartridgeId, numChunks, PROGRAM_ID);
      
      for (let i = 0; i < numChunks; i++) {
        const [singlePda] = deriveChunkPDA(sampleCartridgeId, i, PROGRAM_ID);
        expect(allPdas[i][0].equals(singlePda)).toBe(true);
      }
    });

    it('should return empty array for 0 chunks', () => {
      const pdas = deriveAllChunkPDAs(sampleCartridgeId, 0, PROGRAM_ID);
      expect(pdas.length).toBe(0);
    });
  });
});

