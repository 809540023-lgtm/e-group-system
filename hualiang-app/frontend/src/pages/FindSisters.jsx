import React, { useState } from 'react';
import Header from '../components/common/Header';
import TagFilter from '../components/common/TagFilter';
import Card from '../components/common/Card';
import { Heart, MessageCircle, Phone } from 'lucide-react';
import { members, industryTags, regionTags } from '../data/mockData';

const FindSisters = () => {
  const [selectedIndustry, setSelectedIndustry] = useState('全部');
  const [selectedRegion, setSelectedRegion] = useState('全部');

  const filtered = members.filter(member => {
    const industryMatch = selectedIndustry === '全部' || member.industry === selectedIndustry;
    const regionMatch = selectedRegion === '全部' || member.location === selectedRegion;
    return industryMatch && regionMatch;
  });

  return (
    <div className="page-content">
      <Header title="找姐妹" showBack={false} />

      <div className="sticky top-14 z-10 bg-white border-b">
        <div className="px-4 py-2">
          <p className="text-xs text-gray-600 mb-2">行業篩選</p>
          <TagFilter tags={industryTags} selectedTag={selectedIndustry} onTagChange={setSelectedIndustry} />
        </div>
        <div className="px-4 py-2">
          <p className="text-xs text-gray-600 mb-2">地區篩選</p>
          <TagFilter tags={regionTags} selectedTag={selectedRegion} onTagChange={setSelectedRegion} />
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-gray-600 mb-4">共找到 {filtered.length} 位會姐</p>

        {filtered.map((member) => (
          <Card key={member.id} className="hover:shadow-md">
            <div className="flex gap-4">
              <img
                src={member.avatar}
                alt={member.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{member.name}</h3>
                    <p className="text-xs text-gray-600">{member.title} - {member.company}</p>
                    <p className="text-xs text-gray-500 mt-1">{member.location}</p>
                  </div>
                  <span className="flex items-center gap-1 text-red-500 text-sm">
                    <Heart size={16} fill="currentColor" />
                    {member.hearts}
                  </span>
                </div>

                <p className="text-xs text-gray-700 mt-2 line-clamp-2">{member.description}</p>

                <div className="flex gap-1 mt-2 flex-wrap">
                  {member.tags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <button className="flex-1 flex items-center justify-center gap-1 bg-orange-100 text-orange-700 py-1.5 rounded text-xs font-medium hover:bg-orange-200">
                    <MessageCircle size={14} />
                    Line
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 bg-blue-100 text-blue-700 py-1.5 rounded text-xs font-medium hover:bg-blue-200">
                    <Phone size={14} />
                    電話
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FindSisters;
