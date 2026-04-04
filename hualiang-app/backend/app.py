import os
from flask import Flask, jsonify
from flask_cors import CORS
from config import config
from models import db
from datetime import datetime

def create_app(config_name='development'):
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    CORS(app)

    # Register blueprints
    from routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    # Create tables and seed data
    with app.app_context():
        db.create_all()
        from seed_data import seed_database
        seed_database()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
