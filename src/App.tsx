import { DecryptedView } from './components/DecryptedView';
import { DecryptingView } from './components/DecryptingView';
import { ErrorView } from './components/ErrorView';
import { LockedView } from './components/LockedView';
import { useDecryptionMachine } from './decryption/useDecryptionMachine';

export function App() {
  const missionId = new URLSearchParams(location.search).get('mission_id');
  const { state, submit, retry } = useDecryptionMachine(missionId);

  return (
    <main className="min-h-screen bg-bg-primary text-text font-body">
      <header className="border-b border-border p-4">
        <h1 className="font-display text-primary">STAR CITIZEN // FLEET COMMAND</h1>
        <p className="font-label text-text/70">SECURE COMMUNICATION PROTOCOL</p>
      </header>

      <section className="px-4 py-8">
        {renderStateView(state, submit, retry)}
      </section>

      <footer className="mt-8 border-t border-border p-4">
        <span className="font-label text-text/70">FLEET COMMAND // VERSION 1.0.0</span>
      </footer>
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
      return <DecryptedView mission={state.mission} heroImage={state.heroImage} />;
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
