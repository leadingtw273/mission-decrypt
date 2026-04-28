import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MissionAssetV1 } from './crypto';
import type { State } from './decryption/state';

const { mockUseDecryptionMachine } = vi.hoisted(() => ({
  mockUseDecryptionMachine: vi.fn(),
}));

vi.mock('./decryption/useDecryptionMachine', () => ({
  useDecryptionMachine: mockUseDecryptionMachine,
}));

import { App } from './App';

const sampleAsset: MissionAssetV1 = {
  schemaVersion: '1',
  cryptoVersion: '1',
  lookupVersion: '1',
  normalizationVersion: '1',
  missionId: 'ADE-12345-AB1',
  createdAt: '2026-04-28T10:00:00Z',
  params: {
    kdf: 'PBKDF2-HMAC-SHA256',
    kdfIterations: 600000,
    kdfHash: 'SHA-256',
    derivedKeyLength: 32,
    saltLength: 16,
    cipher: 'AES-256-GCM',
    ivLength: 12,
    gcmTagLength: 16,
    encoding: 'base64url',
    signature: 'Ed25519',
  },
  wrappedKeys: {
    pilot7: { salt: 'AAAA', iv: 'BBBB', wrapped: 'CCCC' },
  },
  fields: {
    missionCommander: { iv: 'iv01', ciphertext: 'AbCdEfGhIjKlMnOpQrStUvWxYz01_-' },
    communicationChannel: { iv: 'iv02', ciphertext: 'zYxWvUtSrQpOnMlKjIhGfEdCbA10_-' },
    missionTime: { iv: 'iv03', ciphertext: 'TimeCipher12345_-TimeCipher12345_-' },
    rallyTime: { iv: 'iv04', ciphertext: 'RallyCipher12345_-RallyCipher12345' },
    rallyLocation: { iv: 'iv05', ciphertext: 'LocationCipher09876_-LocationCipher' },
    requiredGear: { iv: 'iv06', ciphertext: 'GearCipherAlphaBeta12345_-GearCipher' },
    accessPermission: { iv: 'iv07', ciphertext: 'AccessCipherAlphaBeta12345_-Access' },
    rewardDistribution: { iv: 'iv08', ciphertext: 'RewardCipherAlphaBeta12345_-Reward' },
    missionBrief: { iv: 'iv09', ciphertext: 'MissionBriefCipherAlphaBeta12345_-' },
  },
  heroImage: {
    iv: 'heroIv',
    ciphertext: 'heroCipher',
    metadata: {
      mimeType: 'image/jpeg',
      byteLength: 100,
      altText: 'Hero image',
    },
  },
  signature: {
    alg: 'Ed25519',
    publicKeyFingerprint: 'fp',
    value: 'sig',
  },
};

function setMockState(state: State) {
  mockUseDecryptionMachine.mockReturnValue({
    state,
    submit: vi.fn(),
    retry: vi.fn(),
  });
}

describe('App', () => {
  beforeEach(() => {
    mockUseDecryptionMachine.mockReset();
    window.history.replaceState({}, '', '/');
    setMockState({ kind: 'BOOTSTRAPPING' });
  });

  it('renders header and footer chrome', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'STAR CITIZEN // FLEET COMMAND' })).toBeInTheDocument();
    expect(screen.getByText('SECURE COMMUNICATION PROTOCOL')).toBeInTheDocument();
    expect(screen.getByText('FLEET COMMAND // VERSION 1.0.0')).toBeInTheDocument();
  });

  it('shows LOADING TRANSMISSION while bootstrapping', () => {
    setMockState({ kind: 'BOOTSTRAPPING' });

    render(<App />);

    expect(screen.getByText('LOADING TRANSMISSION...')).toBeInTheDocument();
  });

  it('passes mission_id from location.search into useDecryptionMachine', () => {
    window.history.replaceState({}, '', '/?mission_id=OPS-7788');

    render(<App />);

    expect(mockUseDecryptionMachine).toHaveBeenCalledWith('OPS-7788');
  });

  it('renders LockedView when state is LOCKED', () => {
    setMockState({
      kind: 'LOCKED',
      missionId: sampleAsset.missionId,
      asset: sampleAsset,
    });

    render(<App />);

    expect(screen.getByText(/requires verified operator credentials\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'START DECRYPTION' })).toBeInTheDocument();
  });
});
