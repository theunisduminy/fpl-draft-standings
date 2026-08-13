'use client';

import { useState, useTransition } from 'react';

import { updateProfile } from '@/server/actions/profile';
import { Button } from '@/components/ui/button';

/**
 * Edit your own display name and bio.
 *
 * There is no manager picker: which manager you are comes from the curated
 * `league_members` mapping, so it is shown, not chosen.
 */
export function ProfileForm({
  displayName,
  bio,
}: {
  displayName: string | null;
  bio: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await updateProfile(formData);
          setFailed(!result.ok);
          setMessage(result.ok ? 'Profile saved.' : result.error);
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
          rows={3}
          maxLength={500}
          defaultValue={bio ?? ''}
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
