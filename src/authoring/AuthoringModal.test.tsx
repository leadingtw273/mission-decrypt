import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GenerateMissionResult } from './generateMission';
import type { CommanderIdentity } from './identity';
import { AuthoringModal } from './AuthoringModal';
import { pickImage, type PickedImage } from './pickImage';

vi.mock('./pickImage', async () => {
  const actual = await vi.importActual<typeof import('./pickImage')>('./pickImage');

  return {
    ...actual,
    pickImage: vi.fn(),
  };
});

const mockedPickImage = vi.mocked(pickImage);

const sampleIdentity = {
  publicKey: {} as CryptoKey,
  privateKey: {} as CryptoKey,
} satisfies CommanderIdentity;

const sampleResult: GenerateMissionResult = {
  missionId: 'ABC-12345-DE6',
  asset: {
    schemaVersion: '1',
    cryptoVersion: '1',
    lookupVersion: '1',
    normalizationVersion: '1',
    missionId: 'ABC-12345-DE6',
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
      classification: { iv: 'a', ciphertext: 'b' },
      codename: { iv: 'a', ciphertext: 'b' },
      difficulty: { iv: 'a', ciphertext: 'b' },
      missionCommander: { iv: 'a', ciphertext: 'b' },
      communicationChannel: { iv: 'a', ciphertext: 'b' },
      missionTime: { iv: 'a', ciphertext: 'b' },
      rallyTime: { iv: 'a', ciphertext: 'b' },
      rallyLocation: { iv: 'a', ciphertext: 'b' },
      requiredGear: { iv: 'a', ciphertext: 'b' },
      accessPermission: { iv: 'a', ciphertext: 'b' },
      rewardDistribution: { iv: 'a', ciphertext: 'b' },
      missionBrief: { iv: 'a', ciphertext: 'b' },
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
  links: [],
};

const sampleImage: PickedImage = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/png',
  altText: 'Night approach',
};

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
  vi.restoreAllMocks();
});

describe('AuthoringModal', () => {
  it('does not render when open is false', () => {
    render(
      <AuthoringModal
        open={false}
        onClose={vi.fn()}
        onGenerate={vi.fn().mockResolvedValue(sampleResult)}
        identity={null}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders identity setup stage in a portal when identity is null', () => {
    render(
      <AuthoringModal
        open
        onClose={vi.fn()}
        onGenerate={vi.fn().mockResolvedValue(sampleResult)}
        identity={null}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Commander authoring modal' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body).toContainElement(dialog);
    expect(within(dialog).getByRole('button', { name: 'Generate Commander Identity' })).toBeInTheDocument();
  });

  it('renders the authoring form when identity exists', () => {
    render(
      <AuthoringModal
        open
        onClose={vi.fn()}
        onGenerate={vi.fn().mockResolvedValue(sampleResult)}
        identity={sampleIdentity}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Mission Commander' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mission Brief' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Hero Image Alt Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Hero Image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Member' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Mission' })).toBeInTheDocument();
  });

  it('submits the form through onGenerate', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockResolvedValue(sampleResult);
    mockedPickImage.mockResolvedValue(sampleImage);
    installDownloadMocks();

    render(
      <AuthoringModal
        open
        onClose={vi.fn()}
        onGenerate={onGenerate}
        identity={sampleIdentity}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Classification' }), 'extreme');
    await user.type(screen.getByRole('textbox', { name: 'Mission Commander' }), 'Commander Lyra Voss');
    await user.type(screen.getByRole('textbox', { name: 'Communication Channel' }), 'VHF-7 encrypted relay');
    await user.type(screen.getByRole('textbox', { name: 'Estimated Duration' }), '2H');
    fireEvent.change(screen.getByLabelText('Rally Time'), { target: { value: '2026-04-29T23:10' } });
    await user.type(screen.getByRole('textbox', { name: 'Rally Location' }), 'Pier 19, East Harbor');
    await user.type(screen.getByRole('textbox', { name: 'Required Gear' }), 'Thermal cloak');
    await user.type(screen.getByRole('textbox', { name: 'Access Permission' }), 'Level 4');
    await user.type(screen.getByRole('textbox', { name: 'Reward Distribution' }), '40/30/20/10');
    await user.type(screen.getByRole('textbox', { name: 'Mission Brief' }), 'Extract the courier.');
    await user.type(screen.getByRole('textbox', { name: 'Hero Image Alt Text' }), 'Night approach');
    await user.click(screen.getByRole('button', { name: 'Select Hero Image' }));
    await user.clear(screen.getByRole('textbox', { name: 'Member 1 Game ID' }));
    await user.type(screen.getByRole('textbox', { name: 'Member 1 Game ID' }), 'pilot7');
    await user.click(screen.getByRole('button', { name: 'Add Member' }));
    await user.type(screen.getByRole('textbox', { name: 'Member 2 Game ID' }), 'ace42');
    await user.click(screen.getByRole('button', { name: 'Generate Mission' }));

    expect(mockedPickImage).toHaveBeenCalledWith('Night approach');
    expect(onGenerate).toHaveBeenCalledWith({
      mission: expect.objectContaining({
        classification: 'extreme',
        missionCommander: 'Commander Lyra Voss',
        communicationChannel: 'VHF-7 encrypted relay',
        missionTime: '2H',
        rallyTime: expect.stringMatching(/^2026-04-29T23:10:00[+-]\d{2}:\d{2}$/),
        rallyLocation: 'Pier 19, East Harbor',
        requiredGear: 'Thermal cloak',
        accessPermission: 'Level 4',
        rewardDistribution: '40/30/20/10',
        missionBrief: 'Extract the courier.',
      }),
      heroImage: sampleImage,
      members: [{ gameId: 'pilot7' }, { gameId: 'ace42' }],
      identity: { privateKey: sampleIdentity.privateKey },
    });
    expect(screen.getByText('Mission generated successfully')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('closes on Escape when the form is pristine', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AuthoringModal
        open
        onClose={onClose}
        onGenerate={vi.fn().mockResolvedValue(sampleResult)}
        identity={sampleIdentity}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click when the form is pristine', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AuthoringModal
        open
        onClose={onClose}
        onGenerate={vi.fn().mockResolvedValue(sampleResult)}
        identity={sampleIdentity}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    await user.click(screen.getByTestId('authoring-modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus within the modal', async () => {
    const user = userEvent.setup();

    render(
      <AuthoringModal
        open
        onClose={vi.fn()}
        onGenerate={vi.fn().mockResolvedValue(sampleResult)}
        identity={sampleIdentity}
        onGenerateIdentity={vi.fn().mockResolvedValue(sampleIdentity)}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Close Authoring Modal' });
    const lastFocusable = screen.getByRole('textbox', { name: 'Member 1 Game ID' });

    closeButton.focus();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(lastFocusable).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });
});
