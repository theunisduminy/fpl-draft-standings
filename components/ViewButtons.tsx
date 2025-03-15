import { ReactNode, MouseEventHandler } from 'react';

const buttonStyle =
  'px-7 py-3 border-2 rounded-lg text-sm shadow-2xl min-w-[9rem] border-premPurple duration-500';

interface ButtonProps {
  isActive: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

const ViewButton: React.FC<ButtonProps> = ({ isActive, onClick, children }) => (
  <button
    className={`${buttonStyle} ${
      isActive
        ? 'to-ruddyBlue bg-gradient-to-r from-cyan-600 text-white'
        : 'bg-gradient-to-r from-premTurquoise to-premGreen'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

export default ViewButton;
