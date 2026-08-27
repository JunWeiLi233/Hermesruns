import { describe, expect, it } from 'vitest';

import {
  decodeAuthenticationOptions,
  decodeRegistrationOptions,
  serializeCredential,
} from './webauthn';

function bytes(value: BufferSource): number[] {
  const view = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return Array.from(view);
}

describe('admin WebAuthn browser conversion', () => {
  it('decodes every base64url binary field before navigator.credentials.create', () => {
    const decoded = decodeRegistrationOptions({
      challenge: 'AQID',
      user: { id: 'BAUG', name: 'admin@example.test', displayName: 'Admin' },
      rp: { id: 'localhost', name: 'Hermes Admin' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ type: 'public-key', id: 'BwgJ' }],
    });

    expect(bytes(decoded.challenge)).toEqual([1, 2, 3]);
    expect(bytes(decoded.user.id)).toEqual([4, 5, 6]);
    expect(bytes(decoded.excludeCredentials![0].id)).toEqual([7, 8, 9]);
  });

  it('decodes assertion allowCredentials and serializes browser responses', () => {
    const decoded = decodeAuthenticationOptions({
      challenge: 'AQID',
      rpId: 'localhost',
      allowCredentials: [{ type: 'public-key', id: 'BAUG' }],
    });
    expect(bytes(decoded.allowCredentials![0].id)).toEqual([4, 5, 6]);

    const credential = {
      id: 'credential-id',
      type: 'public-key',
      rawId: new Uint8Array([1, 2, 3]).buffer,
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([4, 5]).buffer,
        authenticatorData: new Uint8Array([6, 7]).buffer,
        signature: new Uint8Array([8, 9]).buffer,
        userHandle: null,
      },
    } as unknown as PublicKeyCredential;

    expect(serializeCredential(credential)).toMatchObject({
      id: 'credential-id',
      rawId: 'AQID',
      response: { clientDataJSON: 'BAU', authenticatorData: 'Bgc', signature: 'CAk' },
    });
  });
});
