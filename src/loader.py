import pandas as pd
import sqlite3
import os

from pathlib import Path

import utils

# Config
DATA_DIR = Path("data/raw")

def load_db(db_filename=None):
    """
    Loads a .db file. If no filename is provided, loads the newest one.
    Returns a dictionary containing 'habits' and 'checkmarks'.
    """
    if db_filename:
        db_path = DATA_DIR / db_filename
    else:
        # Get newest .db file automatically
        files = list(DATA_DIR.glob("*.db"))
        if not files: raise FileNotFoundError("No .db files found.")
        db_path = max(files, key=os.path.getctime)

    print(f"Loading: {db_path.name}")
    with sqlite3.connect(db_path) as conn:
        return {
            "habits": pd.read_sql("SELECT * FROM habits", conn),
            "checkmarks": pd.read_sql("SELECT * FROM repetitions", conn)
        }

def load_csv(habit_identifier=None):
    """
    1. Auto-detects the newest 'Loop Habits CSV...' root folder.
    2. If habit_identifier is None or "all", loads root CSV.
    3. If habit_identifier is given (name or number), searches for the matching subfolder.
    """
    # 1. Find the newest root folder starting with "Loop Habits CSV"
    root = list(DATA_DIR.glob("Loop Habits CSV*"))
    if not root:
        raise FileNotFoundError("No CSV folder found in" f" {DATA_DIR}")
    
    # Pick the most recently created folder
    root_path = max(root, key=os.path.getctime)
    target_path = root_path

    # 2. If a specific habit is requested, find its subfolder
    if habit_identifier and habit_identifier != "all":
        found_sub = None
        search_term = str(habit_identifier).lower()

        # Search through subdirectories
        for sub in root_path.iterdir():
            if sub.is_dir() and search_term in sub.name.lower():
                found_sub = sub
                break
        
        if found_sub:
            target_path = found_sub
        else:
            raise FileNotFoundError(f"No subfolder found matching '{habit_identifier}' in {root_path.name}")

    # 3. Load the CSV file inside the determined path
    try:
        csv_file = next(target_path.glob("*.csv"))
        print(f"Loading: {csv_file}")
        return pd.read_csv(csv_file)
    except StopIteration:
        raise FileNotFoundError(f"No CSV found in {target_path}")
    

# --- Usage Examples ---
if __name__ == "__main__":
    
    utils.cls()
    
    df = load_db()  # Load newest .db file
    print(df['habits'].head())

    df = load_csv()  # Load all habits
    print(df.head())

    df = load_csv("Level of Energy")  # Load specific habit by name
    print(df.head())

    df = load_csv(11)  # Load specific habit by number
    print(df.head())