import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MissionAssetV1, MissionPlaintext } from '../crypto';
import { DecryptedView } from './DecryptedView';
import { DecryptingView } from './DecryptingView';
import { ErrorView } from './ErrorView';
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
    classification: { iv: 'iv00', ciphertext: 'ClassificationCipher01234_-ClassCipher' },
    codename: { iv: 'iv00', ciphertext: 'ClassificationCipher01234_-ClassCipher' },
    difficulty: { iv: 'iv00', ciphertext: 'ClassificationCipher01234_-ClassCipher' },
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

const sampleMission: MissionPlaintext = {
  classification: 'high',
  codename: 'TEST OP / 測試任務',
  difficulty: 'normal',
  missionCommander: 'Commander Lyra Voss',
  communicationChannel: 'VHF-7 encrypted relay',
  missionTime: '23:40 UTC',
  rallyTime: '23:10 UTC',
  rallyLocation: 'Pier 19, East Harbor',
  requiredGear: 'Thermal cloak, relay beacon, sidearm',
  accessPermission: 'Level 4 dock clearance',
  rewardDistribution: '40/30/20/10 split',
  missionBrief: 'Extract the courier and secure the black case before dawn.',
};

const sampleHeroImage = {
  mimeType: 'image/png',
  bytes: new Uint8Array([137, 80, 78, 71]),
  altText: 'Fog-covered docks at night',
};

function mockObjectUrlApis() {
  const createObjectURL = vi.fn<(obj: Blob | MediaSource) => string>(() => 'blob:mission-hero');
  const revokeObjectURL = vi.fn<(url: string) => void>();

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revokeObjectURL,
  });

  return { createObjectURL, revokeObjectURL };
}

function mockReducedMotionPreference(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LockedView', () => {
  it('renders mission field labels and ciphertext gibberish', () => {
    mockReducedMotionPreference(true);

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
    expect(toGibberish('AbCdEf123_-', 11)).toBe(toGibberish('AbCdEf123_-', 11));
    expect(toGibberish('AbCdEf123_-', 11)).toMatch(/^[A-Z0-9_\-/%$@!#^&*]+$/);
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

  it('skips motion effects when prefers-reduced-motion is enabled', () => {
    mockReducedMotionPreference(true);

    render(<DecryptingView />);

    expect(screen.getByText('DECRYPTING...')).toHaveAttribute('data-motion', 'reduced');
  });
});

describe('DecryptedView', () => {
  it('renders all 9 mission fields with real values', () => {
    mockReducedMotionPreference(true);
    mockObjectUrlApis();

    render(<DecryptedView asset={sampleAsset} heroImage={sampleHeroImage} mission={sampleMission} />);

    expect(screen.getByText('MISSION COMMANDER')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.missionCommander).parentElement).toHaveClass('font-body');
    expect(screen.getByText('COMMUNICATION CHANNEL')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.communicationChannel).parentElement).toHaveClass('font-body');
    expect(screen.getByText('MISSION TIME')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.missionTime).parentElement).toHaveClass('font-body');
    expect(screen.getByText('RALLY TIME')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.rallyTime).parentElement).toHaveClass('font-body');
    expect(screen.getByText('RALLY LOCATION')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.rallyLocation).parentElement).toHaveClass('font-body');
    expect(screen.getByText('REQUIRED GEAR')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.requiredGear).parentElement).toHaveClass('font-body');
    expect(screen.getByText('ACCESS PERMISSION')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.accessPermission).parentElement).toHaveClass('font-body');
    expect(screen.getByText('REWARD DISTRIBUTION')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.rewardDistribution).parentElement).toHaveClass('font-body');
    expect(screen.getByText('MISSION BRIEF')).toHaveClass('font-label');
    expect(screen.getByText(sampleMission.missionBrief).parentElement).toHaveClass('font-body');
    expect(screen.getByRole('img', { name: sampleHeroImage.altText })).toHaveAttribute('src', 'blob:mission-hero');
  });

  it('creates and revokes object URL for hero image', () => {
    mockReducedMotionPreference(true);
    const { createObjectURL, revokeObjectURL } = mockObjectUrlApis();

    const { unmount } = render(<DecryptedView asset={sampleAsset} heroImage={sampleHeroImage} mission={sampleMission} />);
    const blobArg = createObjectURL.mock.calls.at(0)?.[0];

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg).toMatchObject({ type: sampleHeroImage.mimeType });
    expect(revokeObjectURL).not.toHaveBeenCalled();

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mission-hero');
  });
});

describe('ErrorView', () => {
  it('renders forged_asset warning text with danger styling', () => {
    render(<ErrorView reason="forged_asset" retryable={false} />);

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('⚠️ MISSION SIGNATURE INVALID — DO NOT TRUST')).toHaveClass('text-danger');
  });

  it('shows retry button for not_found', () => {
    render(<ErrorView reason="not_found" retryable />);

    expect(screen.getByRole('button', { name: 'RETRY' })).toBeInTheDocument();
  });

  it('does not show retry button for unsupported_env', () => {
    render(<ErrorView reason="unsupported_env" retryable={false} />);

    expect(screen.queryByRole('button', { name: 'RETRY' })).not.toBeInTheDocument();
  });

  it('triggers onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorView reason="auth_failed" retryable onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'RETRY' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
