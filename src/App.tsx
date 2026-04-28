import { useEffect, useState } from 'react';

import { AuthoringModal } from './authoring/AuthoringModal';
import { generateMission } from './authoring/generateMission';
import type { CommanderIdentity } from './authoring/identity';
import { loadIdentity, saveIdentity } from './authoring/identity';
import { DecryptedView } from './components/DecryptedView';
import { DecryptingView } from './components/DecryptingView';
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
    <main className="flex min-h-screen flex-col bg-bg-primary text-text font-body">
      <header className="border-b border-border p-4">
        <h1 className="font-display text-primary">STAR CITIZEN // FLEET COMMAND</h1>
        <p className="font-label text-text/70">SECURE COMMUNICATION PROTOCOL</p>
      </header>

      <section className="flex-1 px-4 py-8">
        {renderStateView(state, submit, retry)}
      </section>

      <footer className="border-t border-border p-4">
        <span className="font-label text-text/70">FLEET COMMAND // VERSION 1.0.0</span>
      </footer>

      <AuthoringModal
        open={authoringModalOpen}
        onClose={() => setAuthoringModalOpen(false)}
        onGenerate={generateMission}
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
      return <DecryptingView />;
    case 'DECRYPTED':
      return <DecryptedView asset={state.asset} mission={state.mission} heroImage={state.heroImage} />;
    case 'ERROR':
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
