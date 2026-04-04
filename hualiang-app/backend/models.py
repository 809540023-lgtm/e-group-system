from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Member(db.Model):
    __tablename__ = 'members'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company = db.Column(db.String(200))
    industry = db.Column(db.String(100))
    title = db.Column(db.String(100))
    location = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    line_id = db.Column(db.String(100))
    avatar = db.Column(db.String(500))
    description = db.Column(db.Text)
    tags = db.Column(db.String(500))  # JSON string
    hearts = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'company': self.company,
            'industry': self.industry,
            'title': self.title,
            'location': self.location,
            'phone': self.phone,
            'lineId': self.line_id,
            'avatar': self.avatar,
            'description': self.description,
            'tags': self.tags.split(',') if self.tags else [],
            'hearts': self.hearts
        }

class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String(100))
    time = db.Column(db.String(100))
    location = db.Column(db.String(200))
    description = db.Column(db.Text)
    speaker = db.Column(db.String(100))
    registered = db.Column(db.Integer, default=0)
    capacity = db.Column(db.Integer)
    image = db.Column(db.String(500))
    event_type = db.Column(db.String(50))  # '例會' or '活動'
    is_upcoming = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'date': self.date,
            'time': self.time,
            'location': self.location,
            'description': self.description,
            'speaker': self.speaker,
            'registered': self.registered,
            'capacity': self.capacity,
            'image': self.image,
            'type': self.event_type
        }

class News(db.Model):
    __tablename__ = 'news'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.Text)
    content = db.Column(db.Text)
    date = db.Column(db.String(100))
    news_type = db.Column(db.String(50))  # '公告' or '活動'
    important = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'date': self.date,
            'type': self.news_type,
            'important': self.important,
            'summary': self.summary
        }

class BusinessCard(db.Model):
    __tablename__ = 'business_cards'

    id = db.Column(db.Integer, primary_key=True)
    card_type = db.Column(db.String(10))  # 'red' or 'green'
    author = db.Column(db.String(100))
    avatar = db.Column(db.String(500))
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    industry = db.Column(db.String(100))
    urgency = db.Column(db.String(50))  # For red cards
    original_price = db.Column(db.Float)  # For green cards
    discount_price = db.Column(db.Float)  # For green cards
    discount = db.Column(db.Integer)  # For green cards
    deadline = db.Column(db.DateTime)  # For green cards
    date = db.Column(db.String(100))
    hearts = db.Column(db.Integer, default=0)
    shares = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        data = {
            'id': self.id,
            'type': self.card_type,
            'author': self.author,
            'avatar': self.avatar,
            'title': self.title,
            'description': self.description,
            'industry': self.industry,
            'date': self.date,
            'hearts': self.hearts,
            'shares': self.shares
        }

        if self.card_type == 'red':
            data['urgency'] = self.urgency
        else:
            data['originalPrice'] = self.original_price
            data['discountPrice'] = self.discount_price
            data['discount'] = self.discount
            data['deadline'] = self.deadline.isoformat() if self.deadline else None

        return data

class LifePost(db.Model):
    __tablename__ = 'life_posts'

    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(100))
    avatar = db.Column(db.String(500))
    content = db.Column(db.Text)
    images = db.Column(db.String(2000))  # JSON string
    date = db.Column(db.String(100))
    month = db.Column(db.String(100))
    likes = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'author': self.author,
            'avatar': self.avatar,
            'content': self.content,
            'images': self.images.split('|') if self.images else [],
            'date': self.date,
            'month': self.month,
            'likes': self.likes
        }
