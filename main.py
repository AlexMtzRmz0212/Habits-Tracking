import pandas as pd
from cleaner import HabitCleaner
from src.loader import HabitDataLoader

def main():
    # 1. Load raw data
    loader = HabitDataLoader(data_dir="data/raw")
    raw_data = loader.load_data()
    
    # 2. Process with ETL
    cleaner = HabitCleaner()
    
    # 3. Save processed data
    if 'habits' in raw_data and 'events' in raw_data:
        # SQLite format
        habits_df = raw_data['habits']
        events_df = raw_data['events']
        
        # Clean events
        cleaned_events = cleaner.clean_csv_data(events_df)
        categorized = cleaner.categorize_habits(habits_df)
        
        # Save processed data
        cleaned_events.to_csv("data/processed/events_cleaned.csv", index=False)
        habits_df.to_csv("data/processed/habits_cleaned.csv", index=False)
        
        print(f"✅ Processed {len(events_df)} events and {len(habits_df)} habits")
        
    elif 'csv_data' in raw_data:
        # CSV format
        csv_df = raw_data['csv_data']
        cleaned_data = cleaner.clean_csv_data(csv_df)
        
        # Save processed data
        cleaned_data.to_csv("data/processed/combined_cleaned.csv", index=False)
        
        print(f"✅ Processed {len(cleaned_data)} rows from CSV")
    
    print("Data ready for notebooks/ and src/analytics.py")

if __name__ == "__main__":
    main()