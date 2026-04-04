import React, { useState } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import { Calendar, MapPin, Users, Image, Bell } from 'lucide-react';
import { upcomingEvents, pastEvents, latestNews } from '../data/mockData';

const NewsEvents = () => {
  const [activeTab, setActiveTab] = useState('news');

  return (
    <div className="page-content">
      <Header title="消息與活動" showBack={false} />

      {/* Tab Navigation */}
      <div className="sticky top-14 z-10 bg-white border-b flex">
        <button
          onClick={() => setActiveTab('news')}
          className={`flex-1 py-3 text-center font-semibold transition-colors ${
            activeTab === 'news'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Bell size={18} />
            最新消息
          </span>
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-3 text-center font-semibold transition-colors ${
            activeTab === 'events'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <Calendar size={18} />
            活動
          </span>
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {activeTab === 'news' && (
          <>
            <p className="text-sm text-gray-600 mb-4">全部消息</p>
            {latestNews.map((news) => (
              <Card key={news.id} className={news.important ? 'border-l-4 border-l-red-500' : ''}>
                <div className="flex items-start justify-between mb-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    news.important ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {news.type}
                  </div>
                  {news.important && <span className="text-red-500 font-bold">⭐</span>}
                </div>
                <h3 className="font-semibold">{news.title}</h3>
                <p className="text-sm text-gray-700 mt-2">{news.summary}</p>
                <p className="text-xs text-gray-500 mt-2">{news.date}</p>
              </Card>
            ))}
          </>
        )}

        {activeTab === 'events' && (
          <>
            <div>
              <h3 className="font-bold text-lg mb-3">📅 即將舉行</h3>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Card key={event.id} className="overflow-hidden">
                    {event.image && (
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h3 className="font-semibold">{event.title}</h3>
                    <div className="space-y-2 mt-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-orange-500" />
                        {event.date} {event.time}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-orange-500" />
                        {event.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-orange-500" />
                        {event.registered}/{event.capacity} 位參加
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-3">{event.description}</p>
                    {event.speaker && (
                      <p className="text-xs text-gray-500 mt-2">主講人: {event.speaker}</p>
                    )}
                    <button className="w-full mt-3 bg-orange-500 text-white py-2 rounded font-medium hover:bg-orange-600">
                      報名參加
                    </button>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-bold text-lg mb-3">📸 過去活動</h3>
              <div className="space-y-3">
                {pastEvents.map((event) => (
                  <Card key={event.id}>
                    <h3 className="font-semibold">{event.title}</h3>
                    <div className="space-y-1 mt-2 text-sm text-gray-600">
                      <p>📅 {event.date}</p>
                      <p>📍 {event.location}</p>
                      <div className="flex gap-4 mt-2 pt-2 border-t border-gray-200">
                        <span className="flex items-center gap-1">
                          <Users size={14} /> {event.participants} 人參加
                        </span>
                        <span className="flex items-center gap-1">
                          <Image size={14} /> {event.photos} 張相片
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewsEvents;
