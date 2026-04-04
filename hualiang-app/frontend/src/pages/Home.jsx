import React, { useState, useEffect } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import { Heart, Share2, Bell } from 'lucide-react';
import { latestNews, hotOpportunities, redCards, greenCards } from '../data/mockData';

const Home = () => {
  const [selectedNews, setSelectedNews] = useState(null);

  return (
    <div className="page-content">
      <Header title="華亮分會" showBack={false} />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 m-4 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">串連企業女杰</h2>
        <p className="text-orange-100">共創商機，一起成長</p>
      </div>

      {/* Latest News */}
      <div className="px-4 mb-6">
        <h3 className="text-lg font-bold mb-3 flex items-center">
          <Bell size={20} className="mr-2 text-orange-500" />
          最新消息
        </h3>
        <div className="space-y-3">
          {latestNews.slice(0, 2).map((news) => (
            <Card key={news.id} onClick={() => setSelectedNews(news)}>
              <div className="flex items-start gap-3">
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  news.important ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {news.type}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{news.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{news.date}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Hot Opportunities */}
      <div className="px-4 mb-6">
        <h3 className="text-lg font-bold mb-3">🔥 熱門商機</h3>
        <Card>
          <div className="space-y-2">
            {hotOpportunities.map((opp, idx) => (
              <p key={idx} className="text-sm text-gray-700">{opp}</p>
            ))}
          </div>
        </Card>
      </div>

      {/* Business Cards Sample */}
      <div className="px-4 mb-6">
        <h3 className="text-lg font-bold mb-3">商機快訊</h3>
        <div className="space-y-3">
          {redCards.slice(0, 2).map((card) => (
            <Card key={card.id} className="bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <img src={card.avatar} alt={card.author} className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{card.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">{card.author}</p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart size={14} /> {card.hearts}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 size={14} /> {card.shares}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Green Cards Sample */}
      <div className="px-4 mb-6">
        <h3 className="text-lg font-bold mb-3">優惠訊息</h3>
        <div className="space-y-3">
          {greenCards.slice(0, 1).map((card) => (
            <Card key={card.id} className="bg-green-50 border-green-200">
              <div className="flex items-start gap-3">
                <img src={card.avatar} alt={card.author} className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{card.title}</h4>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xs line-through text-gray-500">${card.originalPrice}</span>
                    <span className="text-lg font-bold text-orange-600">${card.discountPrice}</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                      省{card.discount}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
