import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Skeleton table structure
export const skeletonTable = (
  <table className='text-white w-[280px] sm:w-[400px] font-light text-sm'>
    <thead>
      <tr className='border-b-2 border-white'>
        <th className='font-medium w-1/4 py-2'>Player</th>
        <th className='font-medium w-1/4 py-2'>TP Rank</th>
        <th className='font-medium w-1/4 py-2'>H2H Rank</th>
        <th className='font-medium w-1/4 py-2'>Score</th>
      </tr>
    </thead>
    <tbody>
      {/* Placeholder rows */}
      <tr>
        <td className='py-2'>
          <FontAwesomeIcon className='animate-spin' icon={faSpinner} />
        </td>
        <td className='py-2'>
          <FontAwesomeIcon className='animate-spin' icon={faSpinner} />
        </td>
        <td className='py-2'>
          <FontAwesomeIcon className='animate-spin' icon={faSpinner} />
        </td>
        <td className='py-2'>
          <FontAwesomeIcon className='animate-spin' icon={faSpinner} />
        </td>
      </tr>
    </tbody>
  </table>
);
