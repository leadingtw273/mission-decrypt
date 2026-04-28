import exampleAsset from '../../public/missions/_example.json';
import { getCommanderPublicKey } from '../publicKeys/commanderPublicKey';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAsset } from './loadAsset';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadAsset example fixture', () => {
  it('verifies public/missions/_example.json with the dev commander key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockJsonResponse(exampleAsset));

    const result = await loadAsset('_example', await getCommanderPublicKey());

    expect(fetchSpy).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}missions/_example.json?v=1`);
    expect(result).toEqual({ ok: true, asset: exampleAsset });
  });
});

function mockJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}
