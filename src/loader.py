import pandas as pd
import sqlite3
import os
from pathlib import Path

class HabitDataLoader:
    def __init__(self, data_dir="data/raw"):
        self.data_dir = Path(data_dir)
        self.raw_files = list(self.data_dir.glob("*"))
    
    def detect_format(self):
        """Identify newest CSV or DB file."""
        csv_files = list(self.data_dir.glob("*.csv"))
        db_files = list(self.data_dir.glob("*.db"))
        
        # Prefer SQLite for portfolio
        if db_files:
            return max(db_files, key=os.path.getctime), 'db'
        elif csv_files:
            return max(csv_files, key=os.path.getctime), 'csv'
        return None, None
    
    def load_data(self):
        """Load data from detected format."""
        file_path, file_type = self.detect_format()
        
        if file_type == 'db':
            return self._load_from_sqlite(file_path)
        elif file_type == 'csv':
            return self._load_from_csv(file_path)
        else:
            raise FileNotFoundError("No CSV or DB files found")
    
    def _load_from_sqlite(self, db_path):
        """Load from SQLite database."""
        conn = sqlite3.connect(db_path)
        
        # Check tables (your Edit.py logic)
        tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table';", conn)
        print(f"Tables found: {tables['name'].tolist()}")
        
        # Load main tables
        habits_df = pd.read_sql("SELECT * FROM Habits", conn)
        events_df = pd.read_sql("SELECT * FROM Repetitions", conn)
        
        conn.close()
        return {'habits': habits_df, 'events': events_df}
    
    def _load_from_csv(self, csv_path):
        """Load from CSV backup."""
        df = pd.read_csv(csv_path)
        return {'csv_data': df}