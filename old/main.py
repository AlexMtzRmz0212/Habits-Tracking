# run_pipeline.py
import logging
from src import loader, cleaner, database

logging.basicConfig(level=logging.INFO)

def main():
    # 1. Load raw data
    logging.info("Loading raw data...")
    raw_data = loader.load_csv(127) 
    
    # 2. Clean data
    logging.info("Cleaning data...")
    cleaned_data = cleaner.clean(raw_data)

    # 3. Save processed data (optional, if cleaner doesn't already save)
    cleaned_data.to_csv("data/processed/habits_cleaned.csv", index=False)

    # 4. Load into database (if applicable)
    logging.info("Loading into database...")
    database.insert_data(cleaned_data)

    logging.info("Pipeline completed successfully.")

if __name__ == "__main__":
    main()