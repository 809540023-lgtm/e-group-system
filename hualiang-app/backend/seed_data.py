from models import db, Member, Event, News, BusinessCard, LifePost
from datetime import datetime

def seed_database():
    # Check if data already exists
    if Member.query.first():
        return

    # Seed Members
    members_data = [
        {
            'name': '王美玲',
            'company': '美麗花藝工作室',
            'industry': '美業/醫美',
            'title': '創辦人',
            'location': '台北市',
            'phone': '0912-345-678',
            'line_id': 'beautywang',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang&backgroundColor=ffdfbf',
            'description': '專精婚禮花藝設計與企業活動佈置，提供客製化花禮服務',
            'tags': '花藝,婚禮佈置,企業活動',
            'hearts': 28
        },
        {
            'name': '陳雅芳',
            'company': '芳療養生館',
            'industry': '健康/保健',
            'title': '館長',
            'location': '新北市',
            'phone': '0923-456-789',
            'line_id': 'yafangspa',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=yafang&backgroundColor=c0aede',
            'description': '提供專業經絡按摩、精油芳療，致力於身心靈平衡養生',
            'tags': '按摩,芳療,養生',
            'hearts': 35
        },
        {
            'name': '李淑華',
            'company': '華信會計師事務所',
            'industry': '設計/行銷',
            'title': '執業會計師',
            'location': '台北市',
            'phone': '0934-567-890',
            'line_id': 'shuhuaacc',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=shuhua&backgroundColor=b6e3f4',
            'description': '專營中小企業記帳、稅務申報、財務規劃諮詢服務',
            'tags': '會計,稅務,財務規劃',
            'hearts': 42
        },
        {
            'name': '吳秀琴',
            'company': '琴韻美容SPA',
            'industry': '美業/醫美',
            'title': '院長',
            'location': '台南市',
            'phone': '0978-901-234',
            'line_id': 'xiuqinspa',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=xiuqin&backgroundColor=e2e8f0',
            'description': '臉部護理、身體SPA、醫美諮詢，20年專業經驗',
            'tags': '美容,SPA,醫美',
            'hearts': 52
        }
    ]

    for data in members_data:
        member = Member(**data)
        db.session.add(member)

    # Seed Events
    events_data = [
        {
            'title': '3月例會 - 會姐交流茶會',
            'date': '2025年3月25日',
            'time': '14:00 - 17:00',
            'location': '台北市信義區松高路123號5樓',
            'description': '本月主題「數位轉型與商機拓展」',
            'speaker': '黃美鳳 總經理',
            'registered': 28,
            'capacity': 50,
            'image': 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=400&fit=crop',
            'event_type': '例會',
            'is_upcoming': True
        },
        {
            'title': '2月慶生會',
            'date': '2025年2月20日',
            'location': '晶華酒店',
            'event_type': '慶生會',
            'is_upcoming': False
        }
    ]

    for data in events_data:
        event = Event(**data)
        db.session.add(event)

    # Seed News
    news_data = [
        {
            'title': '華亮分會榮獲年度優秀分會獎',
            'date': '2025年3月15日',
            'news_type': '公告',
            'important': True,
            'summary': '感謝全體會姐的努力，華亮分會榮獲總會評選為年度優秀分會！'
        },
        {
            'title': '會費繳交通知',
            'date': '2025年3月1日',
            'news_type': '公告',
            'important': True,
            'summary': '請於3月31日前完成第二季會費繳交。'
        }
    ]

    for data in news_data:
        news = News(**data)
        db.session.add(news)

    # Seed Business Cards
    cards_data = [
        {
            'card_type': 'red',
            'author': '王美玲',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang&backgroundColor=ffdfbf',
            'title': '尋找婚禮場地合作',
            'description': '需要可以配合花藝佈置的婚禮場地',
            'industry': '不動產',
            'urgency': '急',
            'date': '2025-03-18',
            'hearts': 5,
            'shares': 3
        },
        {
            'card_type': 'green',
            'author': '陳雅芳',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=yafang&backgroundColor=c0aede',
            'title': '會姐專屬 - 全身舒壓療程',
            'description': '原價$2,800，會姐特惠價$1,680',
            'industry': '健康/保健',
            'original_price': 2800,
            'discount_price': 1680,
            'discount': 40,
            'date': '2025-03-20',
            'hearts': 15,
            'shares': 12
        }
    ]

    for data in cards_data:
        card = BusinessCard(**data)
        db.session.add(card)

    # Seed Life Posts
    posts_data = [
        {
            'author': '王美玲',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=wang&backgroundColor=ffdfbf',
            'content': '今天完成的婚禮花藝佈置，新人非常滿意！💐',
            'images': 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&h=800&fit=crop',
            'date': '2025-03-17',
            'month': '2025年3月',
            'likes': 28
        },
        {
            'author': '陳雅芳',
            'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=yafang&backgroundColor=c0aede',
            'content': '2月慶生會的美好回憶，大家笑得好開心！🎂',
            'images': 'https://images.unsplash.com/photo-1530103862676-de3c9da59af7?w=600&h=400&fit=crop',
            'date': '2025-02-21',
            'month': '2025年2月',
            'likes': 45
        }
    ]

    for data in posts_data:
        post = LifePost(**data)
        db.session.add(post)

    db.session.commit()
    print("Database seeded successfully!")
