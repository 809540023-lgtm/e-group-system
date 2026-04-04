import React from 'react';
import clsx from 'clsx';

const TagFilter = ({ tags, selectedTag, onTagChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4">
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagChange(tag)}
          className={clsx(
            'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors',
            selectedTag === tag
              ? 'bg-orange-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );
};

export default TagFilter;
