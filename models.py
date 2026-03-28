from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class TestHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    user_requirement = db.Column(db.String(100))
    recommended_tech = db.Column(db.String(50))
    vm_time = db.Column(db.Float)
    docker_time = db.Column(db.Float)
    vm_memory = db.Column(db.Float)
    docker_memory = db.Column(db.Float)