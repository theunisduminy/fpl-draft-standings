import Detail from '@/components/DetailView';
import { bgGradient } from '@/utils/tailwindVars';

export default function DetailView() {
  return (
    <div className={`flex flex-col items-center ${bgGradient} pt-10`}>
      <Detail />
    </div>
  );
}
