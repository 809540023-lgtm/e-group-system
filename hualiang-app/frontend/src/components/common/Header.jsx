import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = ({ title, showBack = true, rightComponent = null }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex-1">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="text-gray-700 hover:text-gray-900 p-1 -ml-1"
            >
              <ArrowLeft size={24} />
            </button>
          )}
        </div>
        <h1 className="text-lg font-semibold text-center flex-1">{title}</h1>
        <div className="flex-1 flex justify-end">
          {rightComponent}
        </div>
      </div>
    </div>
  );
};

export default Header;
