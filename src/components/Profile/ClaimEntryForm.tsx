'use client';

import { useState, useTransition } from 'react';

import { claimLeagueEntry } from '@/server/actions/profile';
import { Button } from '@/components/ui/button';

export interface ClaimableManager {
  id: number;
  label: string;
  claimedByOther: boolean;
}

/**
 * Claim which manager in the league you are.
 *
 * Managers already claimed by someone else are disabled here as a courtesy —
 * the actual rule is enforced in the Server Action, which re-checks before
 * writing. Disabling a control is presentation, not a gate.
 */
export function ClaimEntryForm({
  managers,
  currentEntry,
  currentDisplayName,
  currentBio,
}: {
  managers: ClaimableManager[];
  currentEntry: number | null;
  currentDisplayName: string | null;
  currentBio: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await claimLeagueEntry(formData);
          setFailed(!result.ok);
          setMessage(result.ok ? 'Profile saved.' : result.error);
        });
      }}
      className='space-y-4'
    >
      <div className='space-y-1.5'>
        <label htmlFor='leagueEntry' className='text-sm text-white/70'>
          Which manager are you?
        </label>
        <select
          id='leagueEntry'
          name='leagueEntry'
          defaultValue={currentEntry ?? ''}
          required
          className='w-full rounded-md border border-white/15 bg-[#1a0520] px-3 py-2 text-base text-white md:text-sm'
        >
          <option value='' disabled>
            Select a manager
          </option>
          {managers.map((manager) => (
            <option
              key={manager.id}
              value={manager.id}
              disabled={manager.claimedByOther}
            >
              {manager.label}
              {manager.claimedByOther ? ' — already claimed' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='displayName' className='text-sm text-white/70'>
          Display name
        </label>
        <input
          id='displayName'
          name='displayName'
          defaultValue={currentDisplayName ?? ''}
          placeholder='What the league should call you'
          className='w-full rounded-md border border-white/15 bg-[#1a0520] px-3 py-2 text-base text-white placeholder:text-white/30 md:text-sm'
        />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='bio' className='text-sm text-white/70'>
          Bio
        </label>
        <textarea
          id='bio'
          name='bio'
          rows={3}
          defaultValue={currentBio ?? ''}
          placeholder='Trash talk goes here'
          className='w-full rounded-md border border-white/15 bg-[#1a0520] px-3 py-2 text-base text-white placeholder:text-white/30 md:text-sm'
        />
      </div>

      <div className='flex items-center gap-3'>
        <Button type='submit' disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </Button>
        {message && (
          <span
            className={
              failed ? 'text-sm text-red-400' : 'text-sm text-white/60'
            }
          >
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
