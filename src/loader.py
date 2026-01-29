import pandas as pd
import sqlite3
import os
from pathlib import Path
from typing import Optional, Dict, Tuple, Union
import sys

class HabitDataLoader:
    def __init__(self, data_dir="data/raw"):
        self.data_dir = Path(data_dir)
    
    def detect_available_sources(self) -> Dict[str, Path]:
        """Detect all available data sources in the raw directory."""
        sources = {}
        
        # Find all .db files (Loop Habits Backup files)
        db_files = list(self.data_dir.glob("*.db"))
        if db_files:
            # Get the newest .db file
            newest_db = max(db_files, key=os.path.getctime)
            sources['db'] = newest_db
        
        # Find CSV directories (Loop Habits CSV YYYY-MM-DD/)
        csv_dirs = [d for d in self.data_dir.iterdir() 
                   if d.is_dir() and "Loop Habits CSV" in d.name]
        
        for csv_dir in csv_dirs:
            # Look for Checkmarks.csv in the root of CSV directory
            root_checkmarks = csv_dir / "Checkmarks.csv"
            if root_checkmarks.exists():
                sources[f'csv_root_{csv_dir.name}'] = root_checkmarks
            
            # Look for Checkmarks.csv in subdirectories like [001-150] Habit/
            for subdir in csv_dir.iterdir():
                if subdir.is_dir():
                    sub_checkmarks = subdir / "Checkmarks.csv"
                    if sub_checkmarks.exists():
                        sources[f'csv_sub_{csv_dir.name}_{subdir.name}'] = sub_checkmarks
        
        return sources
    
    def list_sources(self, sources: Dict[str, Path]) -> None:
        """List all available data sources."""
        print("Available data sources:")
        num_habitsFolders = 0
        for key, path in sources.items():
            if key.startswith('csv_sub_'):
                num_habitsFolders += 1
            else:
                print(f"  {key}: {path}")
        if num_habitsFolders > 0:
            print(f"    {num_habitsFolders} habit folders with Checkmarks.csv")
        return sources

    def load_from_source(self, source_key: Optional[str] = None, 
                        csv_dir_name: Optional[str] = None,
                        subfolder_name: Optional[str] = None) -> Dict[str, pd.DataFrame]:
        """
        Load data from a specified source.
        
        Parameters:
        -----------
        source_key : str, optional
            Direct key from detect_available_sources() output
            Example: 'db', 'csv_root_Loop Habits CSV YYYY-MM-DD', etc.
        
        csv_dir_name : str, optional
            Name of the CSV directory (e.g., 'Loop Habits CSV YYYY-MM-DD')
            If specified, will load from that directory.
        
        subfolder_name : str, optional
            Name of subfolder within CSV directory (e.g., '[001-150] Habit')
            If specified with csv_dir_name, loads from subfolder's Checkmarks.csv
        
        Returns:
        --------
        Dictionary with loaded dataframes
        """
        sources = self.detect_available_sources()

        if not sources:
            raise FileNotFoundError("No data sources found in raw directory")
        else:
            self.list_sources(sources)  
            # Output: 
            # Available data sources:
            #   db: data/raw/Loop Habits Backup YYYY-MM-DD ######.db
            #   csv_root_Loop Habits CSV YYYY-MM-DD: data/raw/Loop Habits CSV YYYY-MM-DD/Checkmarks.csv
            #   # habit folders with Checkmarks.csv

        # If source_key is provided, use it directly
        if source_key and source_key in sources:
            return self._load_file(sources[source_key])
        
        # If csv_dir_name is provided
        if csv_dir_name:
            csv_dir = self.data_dir / csv_dir_name
            if not csv_dir.exists():
                raise FileNotFoundError(f"CSV directory not found: {csv_dir_name}")
            
            if subfolder_name:
                # Load from subfolder
                checkmarks_path = csv_dir / subfolder_name / "Checkmarks.csv"
            else:
                # Load from root of CSV directory
                checkmarks_path = csv_dir / "Checkmarks.csv"
            
            if not checkmarks_path.exists():
                raise FileNotFoundError(f"Checkmarks.csv not found at: {checkmarks_path}")
            
            return self._load_csv(checkmarks_path)
        
        # Auto-detect: prefer DB, then CSV
        if 'db' in sources:
            print("Auto-loading from SQLite database...")
            return self._load_sqlite(sources['db'])
        
        # Try to find any CSV source
        csv_sources = {k: v for k, v in sources.items() if k.startswith('csv_')}
        if csv_sources:
            # Get the first CSV source
            first_csv = next(iter(csv_sources.values()))
            print(f"Auto-loading from CSV: {first_csv}")
            return self._load_csv(first_csv)
        
        raise FileNotFoundError("No data sources found in raw directory")
    
    def _load_file(self, file_path: Path) -> Dict[str, pd.DataFrame]:
        """Load file based on extension."""
        if file_path.suffix == '.db':
            return self._load_sqlite(file_path)
        elif file_path.suffix == '.csv':
            return self._load_csv(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
    
    def _load_sqlite(self, db_path: Path) -> Dict[str, pd.DataFrame]:
        """Load from SQLite database."""
        conn = sqlite3.connect(db_path)
        
        # List all tables
        tables = pd.read_sql("SELECT name FROM sqlite_master WHERE type='table';", conn)
        print(f"Tables found: {tables['name'].tolist()}")
        
        # Try to load common table names
        data = {}
        
        # Map possible table names
        table_mapping = {
            'habits': ['Habits', 'habits', 'HABITS'],
            'events': ['Repetitions', 'repetitions', 'REPETITIONS', 'Checkmarks', 'checkmarks'],
            'scores': ['Scores', 'scores', 'SCORES']
        }
        
        for key, possible_names in table_mapping.items():
            for name in possible_names:
                try:
                    data[key] = pd.read_sql(f"SELECT * FROM {name}", conn)
                    print(f"Loaded table '{name}' as '{key}'")
                    break
                except:
                    continue
        
        conn.close()
        
        if not data:
            raise ValueError(f"No recognizable tables found in {db_path}")
        
        return data
    
    def _load_csv(self, csv_path: Path) -> Dict[str, pd.DataFrame]:
        """Load from CSV file."""
        try:
            df = pd.read_csv(csv_path)
            print(f"Loaded CSV with {len(df)} rows and {len(df.columns)} columns")
            return {'checkmarks': df}
        except Exception as e:
            raise ValueError(f"Failed to load CSV {csv_path}: {e}")
    
    def get_latest_sources(self) -> Dict[str, Optional[Path]]:
        """Get the latest DB and CSV sources."""
        sources = self.detect_available_sources()
        
        latest = {'db': None, 'csv': None}
        
        # Get latest DB
        db_files = list(self.data_dir.glob("*.db"))
        if db_files:
            latest['db'] = max(db_files, key=os.path.getctime)
        
        # Get latest CSV directory
        csv_dirs = [d for d in self.data_dir.iterdir() 
                   if d.is_dir() and "Loop Habits CSV" in d.name]
        if csv_dirs:
            latest_csv_dir = max(csv_dirs, key=os.path.getctime)
            # Try root Checkmarks.csv first
            root_csv = latest_csv_dir / "Checkmarks.csv"
            if root_csv.exists():
                latest['csv'] = root_csv
            else:
                # Try to find in subdirectories
                for subdir in latest_csv_dir.iterdir():
                    if subdir.is_dir():
                        sub_csv = subdir / "Checkmarks.csv"
                        if sub_csv.exists():
                            latest['csv'] = sub_csv
                            break
        
        return latest
    

if __name__ == "__main__":
    # Clear the screen
    os.system('cls' if os.name == 'nt' else 'clear')

    # Initialize the loader
    loader = HabitDataLoader("data/raw")
  
    # 1. Load from specific source using key
    # data = loader.load_from_source(source_key='db')
    # data = loader.load_from_source(source_key='csv_root_Loop Habits CSV YYYY-MM-DD')

    # 2. Load by specifying CSV directory (and optional subfolder)
    # data = loader.load_from_source(csv_dir_name='Loop Habits CSV YYYY-MM-DD')
    # data = loader.load_from_source(
        # csv_dir_name='Loop Habits CSV YYYY-MM-DD',
        # subfolder_name='[001-150] Habit'
    # )

    # 3. Get latest sources
    # latest = loader.get_latest_sources()
    # latest['db'] = Path to newest .db file
    # latest['csv'] = Path to newest Checkmarks.csv

    # 4. Load from latest DB
    # if latest['db']:
    #     data = loader._load_sqlite(latest['db'])