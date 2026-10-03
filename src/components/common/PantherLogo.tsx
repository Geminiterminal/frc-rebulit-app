import React from 'react';

interface PantherLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const PantherLogo: React.FC<PantherLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border border-slate-800 shadow-md bg-black flex items-center justify-center ${sizeMap[size]} ${className}`}>
      <img
        src="/icon.svg"
        alt="Panther Logo"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
