import pickle
import os
import re

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')

class TicketClassifier:
    def __init__(self):
        self.cat_model = self._load_model('category_model.pkl')
        self.prio_model = self._load_model('priority_model.pkl')
        
    def _load_model(self, filename):
        path = os.path.join(MODEL_DIR, filename)
        if not os.path.exists(path):
            print(f"Warning: Model {filename} not found at {path}")
            return None
        with open(path, 'rb') as f:
            return pickle.load(f)

    def predict(self, text):
        if not self.cat_model or not self.prio_model:
            return None, None
            
        # The pipeline includes vectorization, so pass raw text list
        cat = self.cat_model.predict([text])[0]
        prio = self.prio_model.predict([text])[0]
        return cat, prio

    def extract_entities(self, text):
        entities = {}
        # Email
        email_match = re.search(r'[\w\.-]+@[\w\.-]+', text)
        if email_match:
            entities['email'] = email_match.group(0)
            
        # Error codes
        error_match = re.search(r'(error\s+\d+|0x[0-9a-fA-F]+)', text, re.IGNORECASE)
        if error_match:
            entities['error_code'] = error_match.group(0)
            
        return entities
