import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type FleetOpsContext,
  createFleetOps,
  registerFleetOpsOnWindow,
} from './fleetOps';

describe('fleetOps', () => {
  let context: FleetOpsContext;

  beforeEach(() => {
    context = {
      openAuthoringModal: vi.fn(),
      loadIdentity: vi.fn().mockResolvedValue(null),
      exportIdentityJwk: vi.fn().mockResolvedValue(null),
      importIdentityJwk: vi.fn().mockResolvedValue(undefined),
      getCommanderPublicKeyFingerprint: vi.fn().mockResolvedValue(null),
    };
    Reflect.deleteProperty(window, 'fleetOps');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'fleetOps');
  });

  it('creates an API with the expected method signatures', () => {
    const api = createFleetOps(context);

    expect(typeof api.help).toBe('function');
    expect(typeof api.launchAuthoring).toBe('function');
    expect(typeof api.exportIdentity).toBe('function');
    expect(typeof api.importIdentity).toBe('function');
    expect(typeof api.whoAmI).toBe('function');
  });

  it('prints help output that mentions launchAuthoring', () => {
    const api = createFleetOps(context);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    api.help();

    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls.flat().join('\n')).toContain('launchAuthoring');
  });

  it('launchAuthoring delegates to the context trigger', () => {
    const api = createFleetOps(context);

    api.launchAuthoring();

    expect(context.openAuthoringModal).toHaveBeenCalledTimes(1);
  });

  it('registers fleetOps on window', () => {
    const api = createFleetOps(context);

    registerFleetOpsOnWindow(api);

    expect(window.fleetOps).toBe(api);
  });

  it('rejects invalid jwk payloads during importIdentity', async () => {
    const api = createFleetOps(context);

    await expect(
      api.importIdentity({
        publicKey: {
          kty: 'RSA',
          crv: 'Ed25519',
          x: 'abc',
        },
        privateKey: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: 'abc',
        },
      }),
    ).rejects.toThrow();

    expect(context.importIdentityJwk).not.toHaveBeenCalled();
  });
});
