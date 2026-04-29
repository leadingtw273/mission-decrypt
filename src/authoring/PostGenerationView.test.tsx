import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GenerateMissionResult } from './generateMission';
import { PostGenerationView } from './PostGenerationView';

function createSampleResult(missionId: string): GenerateMissionResult {
  return {
    missionId,
    asset: {
      schemaVersion: '1',
      cryptoVersion: '1',
      lookupVersion: '1',
      normalizationVersion: '1',
      missionId,
      createdAt: '2026-04-28T10:00:00.000Z',
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
      wrappedKeys: {},
      fields: {
        classification: { iv: 'a', ciphertext: 'b', charCount: 12 },
        codename: { iv: 'a', ciphertext: 'b', charCount: 12 },
        difficulty: { iv: 'a', ciphertext: 'b', charCount: 12 },
        missionCommander: { iv: 'a', ciphertext: 'b', charCount: 12 },
        communicationChannel: { iv: 'a', ciphertext: 'b', charCount: 12 },
        missionTime: { iv: 'a', ciphertext: 'b', charCount: 12 },
        rallyTime: { iv: 'a', ciphertext: 'b', charCount: 12 },
        rallyLocation: { iv: 'a', ciphertext: 'b', charCount: 12 },
        requiredGear: { iv: 'a', ciphertext: 'b', charCount: 12 },
        accessPermission: { iv: 'a', ciphertext: 'b', charCount: 12 },
        rewardDistribution: { iv: 'a', ciphertext: 'b', charCount: 12 },
        missionBrief: { iv: 'a', ciphertext: 'b', charCount: 12 },
      },
      heroImage: {
        iv: 'a',
        ciphertext: 'b',
        metadata: {
          mimeType: 'image/png',
          byteLength: 3,
          altText: 'Hero image',
        },
      },
      signature: {
        alg: 'Ed25519',
        publicKeyFingerprint: 'fp',
        value: 'sig',
      },
    },
    links: [
      {
        gameId: 'pilot7',
        personalKey: 'ABCD-EFGH-JKMN-PQR0',
        url: `https://ops.example/?mission_id=${missionId}`,
      },
      {
        gameId: 'ace42',
        personalKey: 'WXYZ-6789-LMNO-1234',
        url: `https://ops.example/?mission_id=${missionId}`,
      },
    ],
  };
}

function installClipboardMock() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });

  return { writeText };
}

function installDownloadMocks() {
  const createObjectURL = vi.fn<(obj: Blob) => string>(() => 'blob:mission');
  const revokeObjectURL = vi.fn<(url: string) => void>();
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

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

  return { createObjectURL, revokeObjectURL, clickSpy };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PostGenerationView', () => {
  it('renders all members', () => {
    const sampleResult = createSampleResult('ABC-12345-DE6');
    installClipboardMock();
    installDownloadMocks();

    render(<PostGenerationView result={sampleResult} onClose={vi.fn()} />);

    expect(screen.getByText('Mission generated successfully')).toBeInTheDocument();
    expect(screen.getByText('ABC-12345-DE6')).toBeInTheDocument();
    expect(screen.getByText('pilot7')).toBeInTheDocument();
    expect(screen.getByText('ace42')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy URL' })).toHaveLength(2);
  });

  it('copies the URL to the clipboard', async () => {
    const sampleResult = createSampleResult('BCD-12345-EF7');
    const user = userEvent.setup();
    const { writeText } = installClipboardMock();
    installDownloadMocks();

    render(<PostGenerationView result={sampleResult} onClose={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: 'Copy URL' })[0]!);

    expect(writeText).toHaveBeenCalledWith('https://ops.example/?mission_id=BCD-12345-EF7');
  });

  it('copies the plain line to the clipboard', async () => {
    const sampleResult = createSampleResult('CDE-12345-FG8');
    const user = userEvent.setup();
    const { writeText } = installClipboardMock();
    installDownloadMocks();

    render(<PostGenerationView result={sampleResult} onClose={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: 'Copy line' })[0]!);

    expect(writeText).toHaveBeenCalledWith('pilot7 | CDE-12345-FG8 | ABCD-EFGH-JKMN-PQR0 | https://ops.example/?mission_id=CDE-12345-FG8');
  });

  it('copies the Discord paste format to the clipboard', async () => {
    const sampleResult = createSampleResult('DEF-12345-GH9');
    const user = userEvent.setup();
    const { writeText } = installClipboardMock();
    installDownloadMocks();

    render(<PostGenerationView result={sampleResult} onClose={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: 'Copy as Discord paste' })[0]!);

    expect(writeText).toHaveBeenCalledWith(
      '@pilot7 Mission ID: DEF-12345-GH9\nURL: https://ops.example/?mission_id=DEF-12345-GH9\nKey: ABCD-EFGH-JKMN-PQR0',
    );
  });

  it('downloads mission JSON once on initial mount and does not repeat after remount', () => {
    const sampleResult = createSampleResult('EFG-12345-HJ0');
    installClipboardMock();
    const { createObjectURL, revokeObjectURL, clickSpy } = installDownloadMocks();

    const first = render(<PostGenerationView result={sampleResult} onClose={vi.fn()} />);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mission');

    first.unmount();
    render(<PostGenerationView result={sampleResult} onClose={vi.fn()} />);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Done is clicked', async () => {
    const sampleResult = createSampleResult('FGH-12345-JK1');
    const user = userEvent.setup();
    installClipboardMock();
    installDownloadMocks();
    const onClose = vi.fn();

    render(<PostGenerationView result={sampleResult} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
