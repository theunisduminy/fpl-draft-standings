import { clubCrestUrl } from '@/utils/pl-assets';
import type { TeamCode } from '@/interfaces/fpl';
import { cn } from '@/lib/utils';

/**
 * A club crest at text height.
 *
 * A plain `<img>`, not `next/image`: the source is an SVG a couple of
 * characters tall on someone else's CDN, so there is no raster for the
 * optimiser to resize, and routing it through `/_next/image` would need
 * `dangerouslyAllowSVG` for no gain. No `'use client'` either — it renders the
 * same in a Server Component and in the profile form.
 *
 * Decorative by default: every place it is used names the club beside it, so
 * announcing it again would only be noise. Pass `label` if it ever stands
 * alone.
 */
export function ClubCrest({
  code,
  name,
  className,
  label = false,
}: {
  code: TeamCode;
  name: string;
  className?: string;
  /** Announce the club rather than hiding the crest from screen readers. */
  label?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={clubCrestUrl(code)}
      alt={label ? name : ''}
      aria-hidden={label ? undefined : true}
      title={name}
      width={20}
      height={20}
      className={cn('h-5 w-5 shrink-0 object-contain', className)}
    />
  );
}
