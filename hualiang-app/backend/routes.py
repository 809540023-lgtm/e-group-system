from flask import Blueprint, jsonify, request
from models import db, Member, Event, News, BusinessCard, LifePost

api_bp = Blueprint('api', __name__)

# Health check
@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

# Members endpoints
@api_bp.route('/members', methods=['GET'])
def get_members():
    members = Member.query.all()
    return jsonify([m.to_dict() for m in members]), 200

@api_bp.route('/members/<int:member_id>', methods=['GET'])
def get_member(member_id):
    member = Member.query.get_or_404(member_id)
    return jsonify(member.to_dict()), 200

@api_bp.route('/members/search', methods=['GET'])
def search_members():
    industry = request.args.get('industry', '全部')
    region = request.args.get('region', '全部')

    query = Member.query

    if industry != '全部':
        query = query.filter_by(industry=industry)
    if region != '全部':
        query = query.filter_by(location=region)

    members = query.all()
    return jsonify([m.to_dict() for m in members]), 200

@api_bp.route('/members', methods=['POST'])
def create_member():
    data = request.get_json()
    member = Member(
        name=data.get('name'),
        company=data.get('company'),
        industry=data.get('industry'),
        title=data.get('title'),
        location=data.get('location'),
        phone=data.get('phone'),
        line_id=data.get('line_id'),
        avatar=data.get('avatar'),
        description=data.get('description'),
        tags=','.join(data.get('tags', []))
    )
    db.session.add(member)
    db.session.commit()
    return jsonify(member.to_dict()), 201

# Events endpoints
@api_bp.route('/events/upcoming', methods=['GET'])
def get_upcoming_events():
    events = Event.query.filter_by(is_upcoming=True).all()
    return jsonify([e.to_dict() for e in events]), 200

@api_bp.route('/events/past', methods=['GET'])
def get_past_events():
    events = Event.query.filter_by(is_upcoming=False).all()
    return jsonify([e.to_dict() for e in events]), 200

@api_bp.route('/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    event = Event.query.get_or_404(event_id)
    return jsonify(event.to_dict()), 200

@api_bp.route('/events', methods=['POST'])
def create_event():
    data = request.get_json()
    event = Event(
        title=data.get('title'),
        date=data.get('date'),
        time=data.get('time'),
        location=data.get('location'),
        description=data.get('description'),
        speaker=data.get('speaker'),
        capacity=data.get('capacity'),
        image=data.get('image'),
        event_type=data.get('type'),
        is_upcoming=data.get('is_upcoming', True)
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201

# News endpoints
@api_bp.route('/news', methods=['GET'])
def get_news():
    news = News.query.order_by(News.created_at.desc()).all()
    return jsonify([n.to_dict() for n in news]), 200

@api_bp.route('/news/<int:news_id>', methods=['GET'])
def get_news_item(news_id):
    news = News.query.get_or_404(news_id)
    return jsonify(news.to_dict()), 200

@api_bp.route('/news', methods=['POST'])
def create_news():
    data = request.get_json()
    news = News(
        title=data.get('title'),
        summary=data.get('summary'),
        content=data.get('content'),
        date=data.get('date'),
        news_type=data.get('type'),
        important=data.get('important', False)
    )
    db.session.add(news)
    db.session.commit()
    return jsonify(news.to_dict()), 201

# Business Cards endpoints
@api_bp.route('/business/red-cards', methods=['GET'])
def get_red_cards():
    cards = BusinessCard.query.filter_by(card_type='red').all()
    return jsonify([c.to_dict() for c in cards]), 200

@api_bp.route('/business/green-cards', methods=['GET'])
def get_green_cards():
    cards = BusinessCard.query.filter_by(card_type='green').all()
    return jsonify([c.to_dict() for c in cards]), 200

@api_bp.route('/business/hot-opportunities', methods=['GET'])
def get_hot_opportunities():
    opportunities = [
        '🔥 近期最多人找：室內設計師',
        '📈 本月熱門產業：健康保健',
        '💼 新商機：企業團購合作',
        '🌟 推薦會姐：吳秀琴（52個❤️）'
    ]
    return jsonify(opportunities), 200

@api_bp.route('/business/cards', methods=['POST'])
def create_business_card():
    data = request.get_json()
    card = BusinessCard(
        card_type=data.get('type'),
        author=data.get('author'),
        avatar=data.get('avatar'),
        title=data.get('title'),
        description=data.get('description'),
        industry=data.get('industry'),
        urgency=data.get('urgency'),
        original_price=data.get('originalPrice'),
        discount_price=data.get('discountPrice'),
        discount=data.get('discount'),
        date=data.get('date')
    )
    db.session.add(card)
    db.session.commit()
    return jsonify(card.to_dict()), 201

# Life Gallery endpoints
@api_bp.route('/gallery/posts', methods=['GET'])
def get_life_posts():
    month = request.args.get('month')

    if month and month != '全部':
        posts = LifePost.query.filter_by(month=month).all()
    else:
        posts = LifePost.query.all()

    return jsonify([p.to_dict() for p in posts]), 200

@api_bp.route('/gallery/posts/<string:month>', methods=['GET'])
def get_posts_by_month(month):
    posts = LifePost.query.filter_by(month=month).all()
    return jsonify([p.to_dict() for p in posts]), 200

@api_bp.route('/gallery/posts', methods=['POST'])
def create_life_post():
    data = request.get_json()
    post = LifePost(
        author=data.get('author'),
        avatar=data.get('avatar'),
        content=data.get('content'),
        images='|'.join(data.get('images', [])),
        date=data.get('date'),
        month=data.get('month')
    )
    db.session.add(post)
    db.session.commit()
    return jsonify(post.to_dict()), 201
