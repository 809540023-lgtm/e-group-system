import React from 'react';
import clsx from 'clsx';

const Card = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-100 p-4',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      {children}
    </div>
  );
};

export default Card;
