import React, { useState } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import { Heart, Share2 } from 'lucide-react';
import { redCards, greenCards } from '../data/mockData';

const BusinessMatch = () => {
  const [activeTab, setActiveTab] = useState('red');

  const cards = activeTab === 'red' ? redCards : greenCards;

  return (
    <div className="page-content">
      <Header title="商機匹配" showBack={false} />

      {/* Tab Navigation */}
      <div className="sticky top-14 z-10 bg-white border-b flex">
        <button
          onClick={() => setActiveTab('red')}
          className={`flex-1 py-3 text-center font-semibold transition-colors ${
            activeTab === 'red'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🔴 需求紅卡
        </button>
        <button
          onClick={() => setActiveTab('green')}
          className={`flex-1 py-3 text-center font-semibold transition-colors ${
            activeTab === 'green'
              ? 'text-green-600 border-b-2 border-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🟢 優惠綠卡
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {cards.map((card) => (
          <Card
            key={card.id}
            className={activeTab === 'red' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}
          >
            <div className="flex items-start gap-3 mb-3">
              <img
                src={card.avatar}
                alt={card.author}
                className="w-12 h-12 rounded-full"
              />
              <div className="flex-1">
                <h3 className="font-semibold">{card.title}</h3>
                <p className="text-xs text-gray-600">{card.author}</p>
                {activeTab === 'red' && (
                  <div className={`text-xs mt-1 px-2 py-0.5 rounded w-fit ${
                    card.urgency === '急'
                      ? 'bg-red-200 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {card.urgency === '急' ? '🔴 急' : '黃色 普通'}
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-3">{card.description}</p>

            {activeTab === 'green' && (
              <div className="mb-3 p-3 bg-white rounded border-2 border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">原價</p>
                    <p className="text-lg font-bold line-through text-gray-400">${card.originalPrice}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-orange-600 font-bold">優惠</p>
                    <p className="text-xl font-bold text-orange-600">{card.discount}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">優惠價</p>
                    <p className="text-lg font-bold text-orange-600">${card.discountPrice}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 text-xs text-gray-600 pb-3 border-b border-gray-200">
              <span className="bg-gray-100 px-2 py-1 rounded">{card.industry}</span>
              {activeTab === 'red' ? (
                <span className="text-gray-500">{card.date}</span>
              ) : (
                <span className="text-gray-500">截止: {new Date(card.deadline).toLocaleDateString('zh-TW')}</span>
              )}
            </div>

            <div className="flex gap-3 mt-3 pt-3">
              <button className="flex-1 flex items-center justify-center gap-1 text-red-600 hover:bg-red-50 py-2 rounded font-medium text-sm">
                <Heart size={16} />
                {card.hearts}
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 text-blue-600 hover:bg-blue-50 py-2 rounded font-medium text-sm">
                <Share2 size={16} />
                {card.shares}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BusinessMatch;
