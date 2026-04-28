import { useEffect, useRef } from 'react';

import type { MemberLink } from '../crypto';
import { Button } from '../components/shared/Button';
import { FrameBracket } from '../components/shared/FrameBracket';
import type { GenerateMissionResult } from './generateMission';

export interface PostGenerationViewProps {
  result: GenerateMissionResult;
  onClose: () => void;
}

const downloadedMissionIds = new Set<string>();

export function PostGenerationView({ result, onClose }: PostGenerationViewProps) {
  const downloadedRef = useRef(false);

  useEffect(() => {
    if (downloadedRef.current || downloadedMissionIds.has(result.missionId)) {
      return;
    }

    if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
      return;
    }

    downloadedRef.current = true;
    downloadedMissionIds.add(result.missionId);

    const json = JSON.stringify(result.asset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `mission_${result.missionId}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }, [result.asset, result.missionId]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-label text-sm uppercase tracking-[0.22em] text-primary">Mission generated successfully</p>
        <p className="font-body text-sm text-text/78">
          Mission ID: <span className="font-label text-primary">{result.missionId}</span>
        </p>
      </div>

      <FrameBracket
        size={20}
        color="primary"
        className="block overflow-hidden border border-primary/25 bg-bg-secondary/60"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-primary/20 text-left">
                <th className="px-4 py-3 font-label text-xs uppercase tracking-[0.22em] text-text/72">Game ID</th>
                <th className="px-4 py-3 font-label text-xs uppercase tracking-[0.22em] text-text/72">Personal Key</th>
                <th className="px-4 py-3 font-label text-xs uppercase tracking-[0.22em] text-text/72">URL</th>
                <th className="px-4 py-3 font-label text-xs uppercase tracking-[0.22em] text-text/72">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.links.map((link) => (
                <PostGenerationRow key={`${result.missionId}-${link.gameId}`} link={link} missionId={result.missionId} />
              ))}
            </tbody>
          </table>
        </div>
      </FrameBracket>

      <div className="flex justify-end">
        <Button aria-label="Done" type="button" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function PostGenerationRow(props: { missionId: string; link: MemberLink }) {
  const { link, missionId } = props;

  return (
    <tr className="border-b border-primary/10 last:border-b-0">
      <td className="px-4 py-4 font-body text-sm text-text">{link.gameId}</td>
      <td className="px-4 py-4 font-body text-sm text-text">{link.personalKey}</td>
      <td className="px-4 py-4 font-body text-sm text-text">
        <a
          className="break-all text-primary underline decoration-primary/40 underline-offset-4"
          href={link.url}
          rel="noreferrer"
          target="_blank"
        >
          {link.url}
        </a>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void navigator.clipboard.writeText(link.url)}>
            Copy URL
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(formatLine(link, missionId))}
          >
            Copy line
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(formatDiscordPaste(link, missionId))}
          >
            Copy as Discord paste
          </Button>
        </div>
      </td>
    </tr>
  );
}

function formatLine(link: MemberLink, missionId: string) {
  return `${link.gameId} | ${missionId} | ${link.personalKey} | ${link.url}`;
}

function formatDiscordPaste(link: MemberLink, missionId: string) {
  return `@${link.gameId} Mission ID: ${missionId}\nURL: ${link.url}\nKey: ${link.personalKey}`;
}
