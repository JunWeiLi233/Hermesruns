type EncodedDescriptor = Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string };

type EncodedRegistrationOptions = Omit<PublicKeyCredentialCreationOptions, 'challenge' | 'user' | 'excludeCredentials'> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  excludeCredentials?: EncodedDescriptor[];
};

type EncodedAuthenticationOptions = Omit<PublicKeyCredentialRequestOptions, 'challenge' | 'allowCredentials'> & {
  challenge: string;
  allowCredentials?: EncodedDescriptor[];
};

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && typeof navigator !== 'undefined'
    && Boolean(navigator.credentials)
    && typeof window.PublicKeyCredential !== 'undefined';
}

export function decodeRegistrationOptions(
  options: EncodedRegistrationOptions,
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: fromBase64Url(options.challenge),
    user: { ...options.user, id: fromBase64Url(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((credential) => ({
      ...credential,
      id: fromBase64Url(credential.id),
    })),
  };
}

export function decodeAuthenticationOptions(
  options: EncodedAuthenticationOptions,
): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: fromBase64Url(options.challenge),
    allowCredentials: options.allowCredentials?.map((credential) => ({
      ...credential,
      id: fromBase64Url(credential.id),
    })),
  };
}

export async function createPasskey(options: EncodedRegistrationOptions): Promise<Record<string, unknown>> {
  requireWebAuthn();
  const credential = await navigator.credentials.create({
    publicKey: decodeRegistrationOptions(options),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('PASSKEY_CANCELLED');
  }
  return serializeCredential(credential);
}

export async function getPasskey(options: EncodedAuthenticationOptions): Promise<Record<string, unknown>> {
  requireWebAuthn();
  const credential = await navigator.credentials.get({
    publicKey: decodeAuthenticationOptions(options),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('PASSKEY_CANCELLED');
  }
  return serializeCredential(credential);
}

export function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response;
  const base = {
    id: credential.id,
    type: credential.type,
    rawId: toBase64Url(credential.rawId),
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
  };

  if ('attestationObject' in response) {
    const attestation = response as AuthenticatorAttestationResponse;
    return {
      ...base,
      response: {
        clientDataJSON: toBase64Url(attestation.clientDataJSON),
        attestationObject: toBase64Url(attestation.attestationObject),
        transports: typeof attestation.getTransports === 'function' ? attestation.getTransports() : undefined,
      },
    };
  }

  const assertion = response as AuthenticatorAssertionResponse;
  return {
    ...base,
    response: {
      clientDataJSON: toBase64Url(assertion.clientDataJSON),
      authenticatorData: toBase64Url(assertion.authenticatorData),
      signature: toBase64Url(assertion.signature),
      userHandle: assertion.userHandle ? toBase64Url(assertion.userHandle) : null,
    },
  };
}

function requireWebAuthn(): void {
  if (!isWebAuthnSupported()) {
    throw new Error('PASSKEY_UNSUPPORTED');
  }
}

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function toBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
