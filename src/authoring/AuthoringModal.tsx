import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { GenerateMissionInput, GenerateMissionResult } from './generateMission';
import type { CommanderIdentity } from './identity';
import { pickImage, type PickedImage } from './pickImage';
import { Button } from '../components/shared/Button';
import { FrameBracket } from '../components/shared/FrameBracket';
import { Input } from '../components/shared/Input';

export interface AuthoringModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (input: GenerateMissionInput) => Promise<GenerateMissionResult>;
  identity: CommanderIdentity | null;
  onGenerateIdentity: () => Promise<CommanderIdentity>;
}

type Phase = 'identity-setup' | 'authoring' | 'post-generation';
type MissionFormState = Record<MissionFieldName, string>;

type MissionFieldName =
  | 'missionCommander'
  | 'communicationChannel'
  | 'missionTime'
  | 'rallyTime'
  | 'rallyLocation'
  | 'requiredGear'
  | 'accessPermission'
  | 'rewardDistribution'
  | 'missionBrief';

const MISSION_FIELDS: Array<{ name: MissionFieldName; label: string; multiline?: boolean }> = [
  { name: 'missionCommander', label: 'Mission Commander' },
  { name: 'communicationChannel', label: 'Communication Channel' },
  { name: 'missionTime', label: 'Mission Time' },
  { name: 'rallyTime', label: 'Rally Time' },
  { name: 'rallyLocation', label: 'Rally Location' },
  { name: 'requiredGear', label: 'Required Gear' },
  { name: 'accessPermission', label: 'Access Permission' },
  { name: 'rewardDistribution', label: 'Reward Distribution' },
  { name: 'missionBrief', label: 'Mission Brief', multiline: true },
];

const EMPTY_FORM: MissionFormState = {
  missionCommander: '',
  communicationChannel: '',
  missionTime: '',
  rallyTime: '',
  rallyLocation: '',
  requiredGear: '',
  accessPermission: '',
  rewardDistribution: '',
  missionBrief: '',
};

export function AuthoringModal({
  open,
  onClose,
  onGenerate,
  identity,
  onGenerateIdentity,
}: AuthoringModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [localIdentity, setLocalIdentity] = useState<CommanderIdentity | null>(null);
  const [phase, setPhase] = useState<Phase>('identity-setup');
  const [mission, setMission] = useState<MissionFormState>(EMPTY_FORM);
  const [heroAltText, setHeroAltText] = useState('');
  const [heroImage, setHeroImage] = useState<PickedImage | null>(null);
  const [members, setMembers] = useState<string[]>(['']);
  const [isGeneratingIdentity, setIsGeneratingIdentity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerateMissionResult | null>(null);

  const effectiveIdentity = identity ?? localIdentity;
  const dirty = useMemo(
    () =>
      heroAltText.trim().length > 0
      || heroImage !== null
      || members.some((member) => member.trim().length > 0)
      || Object.values(mission).some((value) => value.trim().length > 0),
    [heroAltText, heroImage, members, mission],
  );

  useEffect(() => {
    if (!open) {
      setPhase(identity ? 'authoring' : 'identity-setup');
      setLocalIdentity(null);
      setGeneratedResult(null);
      setMission(EMPTY_FORM);
      setHeroAltText('');
      setHeroImage(null);
      setMembers(['']);
      setIsGeneratingIdentity(false);
      setIsSubmitting(false);
      return;
    }

    setPhase(effectiveIdentity ? 'authoring' : 'identity-setup');
  }, [effectiveIdentity, identity, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        attemptClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  if (!open) {
    return null;
  }

  async function handleGenerateIdentity() {
    setIsGeneratingIdentity(true);
    try {
      const nextIdentity = await onGenerateIdentity();
      setLocalIdentity(nextIdentity);
      setPhase('authoring');
    } finally {
      setIsGeneratingIdentity(false);
    }
  }

  async function handlePickImage() {
    const pickedImage = await pickImage(heroAltText);
    setHeroImage(pickedImage);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveIdentity || !heroImage) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onGenerate({
        mission,
        heroImage,
        members: members
          .map((member) => member.trim())
          .filter((member) => member.length > 0)
          .map((gameId) => ({ gameId })),
        identity: { privateKey: effectiveIdentity.privateKey },
      });
      setGeneratedResult(result);
      setPhase('post-generation');
    } finally {
      setIsSubmitting(false);
    }
  }

  function attemptClose() {
    if (isSubmitting || isGeneratingIdentity) {
      return;
    }
    if (dirty && !window.confirm('Discard unsaved mission input?')) {
      return;
    }
    onClose();
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <button
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-[rgba(6,5,2,0.84)] backdrop-blur-sm"
        data-testid="authoring-modal-backdrop"
        type="button"
        onClick={attemptClose}
      />

      <div
        ref={dialogRef}
        aria-label="Commander authoring modal"
        aria-modal="true"
        className="relative z-10 w-full max-w-6xl outline-none"
        role="dialog"
        onKeyDown={handleDialogKeyDown}
      >
        <FrameBracket
          size={30}
          color="primary"
          className="block border border-primary/35 bg-bg-primary/95 shadow-[0_0_60px_rgba(255,186,0,0.12)]"
        >
          <section className="relative max-h-[90vh] overflow-y-auto px-5 py-5 md:px-8 md:py-8">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-primary/20 pb-4">
              <div>
                <p className="font-label text-xs uppercase tracking-[0.35em] text-primary/75">Vesper Mission Authoring</p>
                <h2 className="font-label mt-2 text-2xl uppercase tracking-[0.22em] text-primary">Commander Control Deck</h2>
              </div>
              <button
                ref={closeButtonRef}
                aria-label="Close Authoring Modal"
                className="font-label border border-primary/30 px-3 py-2 text-xs uppercase tracking-[0.22em] text-primary transition hover:bg-primary/10"
                type="button"
                onClick={attemptClose}
              >
                Close
              </button>
            </div>

            {phase === 'identity-setup' ? (
              <IdentitySetupStage
                isGeneratingIdentity={isGeneratingIdentity}
                onGenerateIdentity={handleGenerateIdentity}
              />
            ) : null}

            {phase === 'authoring' ? (
              <AuthoringStage
                heroAltText={heroAltText}
                heroImage={heroImage}
                isSubmitting={isSubmitting}
                members={members}
                mission={mission}
                onAddMember={() => setMembers((current) => [...current, ''])}
                onHeroAltTextChange={setHeroAltText}
                onPickImage={handlePickImage}
                onRemoveMember={(index) =>
                  setMembers((current) => current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index))}
                onSubmit={handleSubmit}
                onUpdateMember={(index, value) =>
                  setMembers((current) => current.map((member, currentIndex) => currentIndex === index ? value : member))}
                onUpdateMission={(field, value) => setMission((current) => ({ ...current, [field]: value }))}
              />
            ) : null}

            {phase === 'post-generation' ? (
              <PostGenerationPlaceholder result={generatedResult} />
            ) : null}
          </section>
        </FrameBracket>
      </div>
    </div>,
    document.body,
  );
}

function IdentitySetupStage(
  { isGeneratingIdentity, onGenerateIdentity }: { isGeneratingIdentity: boolean; onGenerateIdentity: () => Promise<void> },
) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.82fr)] lg:items-center">
      <div className="space-y-4">
        <p className="font-label text-sm uppercase tracking-[0.24em] text-primary">Identity Setup</p>
        <p className="font-body max-w-2xl text-sm leading-7 text-text/78">
          Generate the commander signing identity locally before authoring any mission payload. The private key remains in browser storage.
        </p>
      </div>

      <FrameBracket
        size={24}
        color="primary"
        className="block border border-primary/25 bg-bg-secondary/70 px-6 py-7"
      >
        <div className="space-y-4">
          <p className="font-label text-xs uppercase tracking-[0.22em] text-text/70">No commander identity detected.</p>
          <Button
            aria-label="Generate Commander Identity"
            className="w-full"
            disabled={isGeneratingIdentity}
            type="button"
            variant="primary"
            onClick={onGenerateIdentity}
          >
            Generate Commander Identity
          </Button>
        </div>
      </FrameBracket>
    </div>
  );
}

function AuthoringStage(props: {
  mission: MissionFormState;
  heroAltText: string;
  heroImage: PickedImage | null;
  members: string[];
  isSubmitting: boolean;
  onUpdateMission: (field: MissionFieldName, value: string) => void;
  onHeroAltTextChange: (value: string) => void;
  onPickImage: () => Promise<void>;
  onAddMember: () => void;
  onRemoveMember: (index: number) => void;
  onUpdateMember: (index: number, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]" onSubmit={props.onSubmit}>
      <div className="grid gap-4">
        {MISSION_FIELDS.map((field) => (
          <MissionFieldControl
            key={field.name}
            label={field.label}
            name={field.name}
            value={props.mission[field.name]}
            {...(field.multiline ? { multiline: true } : {})}
            onChange={(value) => props.onUpdateMission(field.name, value)}
          />
        ))}
      </div>

      <div className="grid gap-5 content-start">
        <FrameBracket
          size={20}
          color="primary"
          className="block border border-primary/25 bg-bg-secondary/60 px-4 py-4"
        >
          <div className="space-y-4">
            <TextInputControl
              label="Hero Image Alt Text"
              name="hero-alt-text"
              value={props.heroAltText}
              onChange={props.onHeroAltTextChange}
            />
            <div className="space-y-2">
              <Button
                aria-label="Select Hero Image"
                className="w-full"
                type="button"
                variant="secondary"
                onClick={props.onPickImage}
              >
                Select Hero Image
              </Button>
              <p className="font-body text-xs text-text/70">
                {props.heroImage ? `${props.heroImage.mimeType} · ${props.heroImage.bytes.byteLength} bytes loaded` : 'No hero image selected.'}
              </p>
            </div>
          </div>
        </FrameBracket>

        <FrameBracket
          size={20}
          color="primary"
          className="block border border-primary/25 bg-bg-secondary/60 px-4 py-4"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-label text-xs uppercase tracking-[0.22em] text-primary">Members</p>
              <Button aria-label="Add Member" type="button" variant="secondary" onClick={props.onAddMember}>
                Add Member
              </Button>
            </div>

            <div className="grid gap-3">
              {props.members.map((member, index) => (
                <MemberFieldRow
                  key={`member-${index + 1}`}
                  canRemove={props.members.length > 1}
                  index={index}
                  value={member}
                  onChange={(value) => props.onUpdateMember(index, value)}
                  onRemove={() => props.onRemoveMember(index)}
                />
              ))}
            </div>
          </div>
        </FrameBracket>

        <Button
          aria-label="Generate Mission"
          className="w-full"
          disabled={props.isSubmitting || !props.heroImage}
          type="submit"
          variant="primary"
        >
          Generate Mission
        </Button>
      </div>
    </form>
  );
}

function MissionFieldControl(props: {
  name: MissionFieldName;
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <label className="space-y-2" htmlFor={id}>
      <span className="font-label text-xs uppercase tracking-[0.22em] text-text/72">{props.label}</span>
      {props.multiline ? (
        <textarea
          aria-label={props.label}
          className="font-body min-h-32 w-full resize-y border border-border bg-bg-secondary/70 px-5 py-4 text-text outline-none transition focus:border-primary"
          id={id}
          required
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      ) : (
        <Input
          aria-label={props.label}
          id={id}
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      )}
    </label>
  );
}

function TextInputControl(props: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <label className="space-y-2" htmlFor={id}>
      <span className="font-label text-xs uppercase tracking-[0.22em] text-text/72">{props.label}</span>
      <Input
        aria-label={props.label}
        id={id}
        name={props.name}
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function MemberFieldRow(props: {
  index: number;
  value: string;
  canRemove: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const label = `Member ${props.index + 1} Game ID`;

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="space-y-2" htmlFor={id}>
        <span className="font-label text-xs uppercase tracking-[0.22em] text-text/72">{label}</span>
        <Input
          aria-label={label}
          id={id}
          name={`member-${props.index + 1}`}
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      </label>
      {props.canRemove ? (
        <Button
          aria-label={`Remove Member ${props.index + 1}`}
          className="sm:min-w-28"
          type="button"
          variant="secondary"
          onClick={props.onRemove}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}

function PostGenerationPlaceholder({ result }: { result: GenerateMissionResult | null }) {
  return (
    <div className="space-y-4">
      <p className="font-label text-sm uppercase tracking-[0.22em] text-primary">Post-generation</p>
      <p className="font-body text-sm text-text/75">
        Mission {result?.missionId ?? 'unknown'} generated. Full post-generation delivery UI lands in Task 3.4.
      </p>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );

  return elements.filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}
