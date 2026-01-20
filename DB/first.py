import sqlite3
import os

# Define the path to the Data folder and the .db file
data_folder = 'Data'
db_file = None

# Find the .db file in the Data folder
for file in os.listdir(data_folder):
    if file.endswith('.db'):
        db_file = os.path.join(data_folder, file)
        break

if db_file:
    # Connect to the database
    conn = sqlite3.connect(db_file)
    print(f"Connected to the database: {db_file}")
else:
    print("No .db file found in the Data folder.")