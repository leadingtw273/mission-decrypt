import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MissionAssetV1 } from '../crypto';
import { DecryptingView } from './DecryptingView';
import { LockedView, toGibberish } from './LockedView';

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

describe('LockedView', () => {
  it('renders mission field labels and ciphertext gibberish', () => {
    render(<LockedView asset={sampleAsset} onSubmit={vi.fn()} submitting={false} />);

    expect(screen.getByText('MISSION COMMANDER')).toHaveClass('font-label');
    expect(screen.getByText('COMMUNICATION CHANNEL')).toHaveClass('font-label');

    const gibberish = toGibberish(sampleAsset.fields.missionCommander.ciphertext, 24);
    expect(screen.getByText(gibberish)).toBeInTheDocument();
    expect(screen.queryByText(sampleAsset.fields.missionCommander.ciphertext)).not.toBeInTheDocument();
  });

  it('submits game id and private key through onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<LockedView asset={sampleAsset} onSubmit={onSubmit} submitting={false} />);

    await user.type(screen.getByRole('textbox', { name: 'Game ID' }), 'PILOT-7');
    await user.type(screen.getByLabelText('Private Key'), 'PK-SECRET-001');
    await user.click(screen.getByRole('button', { name: 'START DECRYPTION' }));

    expect(onSubmit).toHaveBeenCalledWith('PILOT-7', 'PK-SECRET-001');
  });

  it('disables the submit button while submitting', () => {
    render(<LockedView asset={sampleAsset} onSubmit={vi.fn()} submitting />);

    expect(screen.getByRole('button', { name: 'START DECRYPTION' })).toBeDisabled();
  });

  it('maps the same ciphertext to the same gibberish deterministically', () => {
    expect(toGibberish('AbCdEf123_-', 18)).toBe(toGibberish('AbCdEf123_-', 18));
    expect(toGibberish('AbCdEf123_-', 18)).toMatch(/^[%$@!#^&*()_+\[\]{};'\"<>?\/~]+$/);
  });
});

describe('DecryptingView', () => {
  it('renders DECRYPTING text', () => {
    render(<DecryptingView />);

    expect(screen.getByText('DECRYPTING...')).toBeInTheDocument();
  });

  it('has role=status and aria-live=polite', () => {
    render(<DecryptingView />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
