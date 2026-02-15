import pickle
import os
import re

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')

class TicketClassifier:
    def __init__(self):
        self.cat_model = self._load_model('category_model.pkl')
        self.prio_model = self._load_model('priority_model.pkl')
        
    def _fallback_classify(self, text):
        t = text.lower()
        billing_kw = ['billing', 'invoice', 'payment', 'paid', 'charge', 'refund', 'card', 'upi']
        account_kw = ['login', 'password', 'signin', 'signup', 'account', '2fa', 'otp', 'verification']
        tech_kw = ['error', 'bug', 'issue', 'crash', 'server', 'api', 'timeout', 'down', 'fail', 'broken']
        sales_kw = ['price', 'cost', 'quote', 'plan', 'subscription', 'upgrade', 'downgrade']
        urgent_kw = ['urgent', 'asap', 'immediately', 'critical', 'not working', 'cannot', 'blocked', 'failed']
        
        if any(k in t for k in billing_kw):
            cat = 'Billing and Payments'
        elif any(k in t for k in account_kw):
            cat = 'Account Access'
        elif any(k in t for k in tech_kw):
            cat = 'Technical Support'
        elif any(k in t for k in sales_kw):
            cat = 'Sales and Pricing'
        else:
            cat = 'General Inquiry'
        
        prio = 'High' if any(k in t for k in urgent_kw) else ('Medium' if len(t) > 120 else 'Low')
        return cat, prio
        
    def _load_model(self, filename):
        path = os.path.join(MODEL_DIR, filename)
        if not os.path.exists(path):
            print(f"Warning: Model {filename} not found at {path}")
            return None
        with open(path, 'rb') as f:
            return pickle.load(f)

    def predict(self, text):
        if not self.cat_model or not self.prio_model:
            cat, prio = self._fallback_classify(text)
            return cat, prio
        cat = self.cat_model.predict([text])[0]
        prio = self.prio_model.predict([text])[0]
        t = text.lower()
        billing_kw = ['billing', 'invoice', 'payment', 'paid', 'charge', 'refund', 'card', 'upi']
        if cat == 'Billing and Payments' and not any(k in t for k in billing_kw):
            cat, prio = self._fallback_classify(text)
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
