import sqlite3
import os
os.system('cls' if os.name == 'nt' else 'clear')
# Path to your .db file
db_path = 'Loop Habits Backup 2025-09-26 232837.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# # Fetch all table names
# cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
# tables = cursor.fetchall()
# for table in tables:
#     print(table[0])

# print('=' * 50)

# table_name = 'android_metadata'
# table_name = 'Habits'
table_name = 'sqlite_sequence'
# table_name = 'Events'
# table_name = 'Repetitions'

cursor.execute(f"SELECT * FROM {table_name}")
rows = cursor.fetchall()
column_names = [description[0] for description in cursor.description]
print("Column names:", column_names)
for row in rows:
    print(row)