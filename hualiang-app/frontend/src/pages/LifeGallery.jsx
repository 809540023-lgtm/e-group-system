import React, { useState } from 'react';
import Header from '../components/common/Header';
import TagFilter from '../components/common/TagFilter';
import Card from '../components/common/Card';
import { Heart, MessageCircle } from 'lucide-react';
import { lifePosts, monthGroups } from '../data/mockData';

const LifeGallery = () => {
  const [selectedMonth, setSelectedMonth] = useState('全部');

  const filtered = selectedMonth === '全部'
    ? lifePosts
    : lifePosts.filter(post => post.month === selectedMonth);

  return (
    <div className="page-content">
      <Header title="生活分享" showBack={false} />

      <div className="sticky top-14 z-10 bg-white border-b px-4 py-2">
        <p className="text-xs text-gray-600 mb-2">選擇月份</p>
        <TagFilter tags={monthGroups} selectedTag={selectedMonth} onTagChange={setSelectedMonth} />
      </div>

      <div className="px-4 py-4 space-y-4">
        {filtered.map((post) => (
          <Card key={post.id}>
            <div className="flex items-start gap-3 mb-3">
              <img
                src={post.avatar}
                alt={post.author}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <h3 className="font-semibold text-sm">{post.author}</h3>
                <p className="text-xs text-gray-500">{post.date}</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-3">{post.content}</p>

            {post.images && post.images.length > 0 && (
              <div className={`grid gap-2 mb-3 ${
                post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}>
                {post.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Post ${idx}`}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                ))}
              </div>
            )}

            <div className="flex gap-4 pt-3 border-t border-gray-200">
              <button className="flex items-center gap-1 text-gray-600 hover:text-red-600 text-sm">
                <Heart size={16} />
                {post.likes}
              </button>
              <button className="flex items-center gap-1 text-gray-600 hover:text-blue-600 text-sm">
                <MessageCircle size={16} />
                評論
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LifeGallery;
