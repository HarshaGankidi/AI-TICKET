import csv
import pickle
import os
import sys
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report

# Paths
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'data', 'dataset', 'aa_dataset-tickets-multi-lang-5-2-50-version.csv')
MODEL_DIR = os.path.dirname(__file__)
MODEL_OUTPUT_DIR = os.path.join(MODEL_DIR, 'models')

def load_data(filepath):
    texts = []
    categories = []
    priorities = []
    
    print(f"Loading data from {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Filter for English to ensure high quality for this demo
            if row['language'] == 'en':
                # Combine subject and body for better context
                text = f"{row['subject']} {row['body']}"
                texts.append(text)
                categories.append(row['queue'])
                priorities.append(row['priority'])
    
    print(f"Loaded {len(texts)} English samples.")
    return texts, categories, priorities

def train_and_save_model(X, y, name):
    print(f"Training {name} model...")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Pipeline: TF-IDF + SVM (SGDClassifier is efficient for text)
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(stop_words='english', max_features=5000, ngram_range=(1, 2))),
        ('clf', SGDClassifier(loss='hinge', penalty='l2', alpha=1e-3, random_state=42, max_iter=5, tol=None))
    ])
    
    # Grid Search for optimization
    parameters = {
        'tfidf__use_idf': (True, False),
        'clf__alpha': (1e-2, 1e-3),
    }
    
    grid_search = GridSearchCV(pipeline, parameters, n_jobs=-1, verbose=1)
    grid_search.fit(X_train, y_train)
    
    print(f"Best score: {grid_search.best_score_}")
    print("Best parameters set:")
    best_parameters = grid_search.best_estimator_.get_params()
    for param_name in sorted(parameters.keys()):
        print(f"\t{param_name}: {best_parameters[param_name]}")
        
    # Evaluate
    y_pred = grid_search.predict(X_test)
    print(classification_report(y_test, y_pred))
    
    # Save best model
    output_path = os.path.join(MODEL_OUTPUT_DIR, f"{name}_model.pkl")
    with open(output_path, 'wb') as f:
        pickle.dump(grid_search.best_estimator_, f)
    print(f"Model saved to {output_path}")

def main():
    if not os.path.exists(MODEL_OUTPUT_DIR):
        os.makedirs(MODEL_OUTPUT_DIR)
        
    X, y_cat, y_prio = load_data(DATA_PATH)
    
    if not X:
        print("No data found!")
        return

    train_and_save_model(X, y_cat, "category")
    train_and_save_model(X, y_prio, "priority")

if __name__ == "__main__":
    main()
