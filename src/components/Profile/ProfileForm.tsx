'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { updateProfile } from '@/server/actions/profile';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClubCrest } from '@/components/ClubCrest';
import type { PlTeam, TeamCode } from '@/interfaces/fpl';

/**
 * Edit your own display name, bio and club.
 *
 * There is no manager picker: which manager you are comes from the curated
 * `league_members` mapping, so it is shown, not chosen.
 *
 * All three fields are required, and `required` here is only the courtesy half
 * of that — the real enforcement is `updateProfile` rejecting a blank one, and
 * `(onboarded)/layout.tsx` refusing to let anyone past `/profile` until the row
 * is filled in. A Server Action is a public POST endpoint; an attribute in the
 * markup is not a rule.
 *
 * The club has no "no allegiance" option any more. Everyone in this league
 * supports someone, and "none" was a field nobody filled in rather than an
 * answer anybody meant.
 *
 * `onboarding` only changes where you land. Saving from the compulsory step
 * pushes you on to the standings, because that is the thing you were trying to
 * reach when you got sent here.
 */
export function ProfileForm({
  displayName,
  bio,
  favouriteTeam,
  teams,
  onboarding = false,
}: {
  displayName: string | null;
  bio: string | null;
  favouriteTeam: TeamCode | null;
  /** The 20 clubs, already sorted. The page reads them; this only renders. */
  teams: PlTeam[];
  onboarding?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Empty until they choose. Radix will not accept `''` as an item value, but
  // it accepts it as *no* value, which is what shows the placeholder.
  const [team, setTeam] = useState(
    favouriteTeam === null ? '' : String(favouriteTeam),
  );

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await updateProfile(formData);
          setFailed(!result.ok);
          setMessage(result.ok ? 'Profile saved.' : result.error);
          if (result.ok && onboarding) router.push('/');
        });
      }}
      className='space-y-4'
    >
      <div className='space-y-1.5'>
        <label htmlFor='displayName' className='text-sm text-white/70'>
          Display name
        </label>
        <input
          id='displayName'
          name='displayName'
          required
          maxLength={60}
          defaultValue={displayName ?? ''}
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
          required
          rows={3}
          maxLength={500}
          defaultValue={bio ?? ''}
          placeholder='Trash talk goes here'
          className='w-full rounded-md border border-white/15 bg-[#1a0520] px-3 py-2 text-base text-white placeholder:text-white/30 md:text-sm'
        />
      </div>

      <div className='space-y-1.5'>
        <label htmlFor='favouriteTeam' className='text-sm text-white/70'>
          Club you support
        </label>
        {/* Radix renders a button, not a form control, so the value reaches
            the action through this input rather than the trigger. */}
        <input type='hidden' name='favouriteTeam' value={team} />
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger
            id='favouriteTeam'
            aria-label='Club you support'
            className='h-auto w-full rounded-md border-white/15 bg-[#1a0520] px-3 py-2.5 text-base text-white md:text-sm'
          >
            {/* No crest here: `SelectValue` renders the chosen item's own
                children, which already carry one. */}
            <SelectValue placeholder='Pick a club' />
          </SelectTrigger>
          <SelectContent className='border-white/20 bg-[#1a0520]'>
            {teams.map((plTeam) => (
              <SelectItem
                key={plTeam.code}
                value={String(plTeam.code)}
                className='text-white focus:bg-white/10 focus:text-white'
              >
                <span className='flex items-center gap-2'>
                  <ClubCrest name={plTeam.name} code={plTeam.code} />
                  {plTeam.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex items-center gap-3'>
        <Button type='submit' disabled={pending}>
          {pending
            ? 'Saving…'
            : onboarding
              ? 'Save and continue'
              : 'Save profile'}
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
