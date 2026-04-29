import { useEffect, useState } from 'react';

import { AuthoringModal } from './authoring/AuthoringModal';
import { extendMission } from './authoring/extendMission';
import { generateMission } from './authoring/generateMission';
import type { CommanderIdentity } from './authoring/identity';
import { loadIdentity, saveIdentity } from './authoring/identity';
import { DecryptedView } from './components/DecryptedView';
import { ErrorModal } from './components/ErrorModal';
import { ErrorView } from './components/ErrorView';
import { LockedView } from './components/LockedView';
import { generateSigningKeypair } from './crypto/sign';
import { useDecryptionMachine } from './decryption/useDecryptionMachine';

export function App() {
  const missionId = new URLSearchParams(location.search).get('mission_id');
  const { state, submit, retry } = useDecryptionMachine(missionId);
  const [authoringModalOpen, setAuthoringModalOpen] = useState(false);
  const [identity, setIdentity] = useState<CommanderIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadIdentity().then((nextIdentity) => {
      if (!cancelled) {
        setIdentity(nextIdentity);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleOpenAuthoring() {
      setAuthoringModalOpen(true);
    }

    window.addEventListener('fleetops:open-authoring', handleOpenAuthoring);
    return () => window.removeEventListener('fleetops:open-authoring', handleOpenAuthoring);
  }, []);

  async function handleGenerateIdentity() {
    const keypair = await generateSigningKeypair();
    await saveIdentity(keypair);
    setIdentity(keypair);
    return keypair;
  }

  return (
    <main className="flex min-h-screen flex-col bg-bg-primary text-text font-body md:min-w-[768px]">
      <header className="border-b border-border p-4">
        <h1 className="font-display text-primary">STAR CITIZEN // FLEET COMMAND</h1>
        <p className="font-label text-text/70">SECURE COMMUNICATION PROTOCOL</p>
      </header>

      <section className="mx-auto flex w-full flex-1 flex-col justify-center md:w-[70%] md:min-w-[768px] md:py-8">
        {renderStateView(state, submit, retry)}
      </section>

      <footer className="border-t border-border p-4">
        <span className="font-label text-text/70">FLEET COMMAND // VERSION 1.0.0</span>
      </footer>

      <AuthoringModal
        open={authoringModalOpen}
        onClose={() => setAuthoringModalOpen(false)}
        onGenerate={generateMission}
        onExtend={extendMission}
        identity={identity}
        onGenerateIdentity={handleGenerateIdentity}
      />
    </main>
  );
}

function renderStateView(
  state: ReturnType<typeof useDecryptionMachine>['state'],
  submit: ReturnType<typeof useDecryptionMachine>['submit'],
  retry: ReturnType<typeof useDecryptionMachine>['retry'],
) {
  switch (state.kind) {
    case 'BOOTSTRAPPING':
    case 'ASSET_LOADING':
      return <BootingView />;
    case 'LOCKED':
      return <LockedView asset={state.asset} onSubmit={submit} submitting={false} />;
    case 'DECRYPTING':
      return <LockedView asset={state.asset} onSubmit={submit} submitting={true} />;
    case 'DECRYPTED':
      return <DecryptedView asset={state.asset} mission={state.mission} heroImage={state.heroImage} />;
    case 'ERROR':
      // Retryable errors that still hold a parsed asset stay on top of the
      // form (so the user keeps the credentials they typed) and surface the
      // failure via a blurred-backdrop modal. Other errors (no asset, fatal
      // signature/verification failures) fall through to the full-page view.
      if (state.retryable && state.lastAsset) {
        return (
          <div className="relative">
            <LockedView asset={state.lastAsset} onSubmit={submit} submitting={false} />
            <ErrorModal reason={state.reason} onRetry={retry} />
          </div>
        );
      }
      return state.retryable ? (
        <ErrorView reason={state.reason} retryable={state.retryable} onRetry={retry} />
      ) : (
        <ErrorView reason={state.reason} retryable={state.retryable} />
      );
  }
}

function BootingView() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="font-display text-primary">LOADING TRANSMISSION...</p>
    </div>
  );
}
