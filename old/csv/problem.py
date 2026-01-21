import pandas as pd

# clear terminal
import os
os.system('cls' if os.name == 'nt' else 'clear')

df = pd.read_csv('Checkmarks.csv')

#region print all columns
# for i, column in enumerate(df.columns, start=1):
#     print(f"{i}. \t{column}")
# input("\n\nPress Enter to continue...")
# os.system('cls' if os.name == 'nt' else 'clear')
# endregion

# Select column Problem and Date
df = df[['Problem', 'Date']]

# Convert the 'Date' column to datetime format
df['Date'] = pd.to_datetime(df['Date'], format='%Y-%m-%d', errors='coerce')

# Turn 2 to Held, 0 to Unregistered, -1 to Not Held 
df['Problem'] = df['Problem'].replace({2: 'Held', 0: 'Not Held', -1: 'Unregistered'})

# Make a table with the number of Held, Unregistered and Not Held problems per month and week
df['Month'] = df['Date'].dt.to_period('M')
df['Week'] = df['Date'].dt.to_period('W')

# Make the table by month and week
df_month = df.groupby(['Month', 'Problem']).size().unstack(fill_value=0)
df_week = df.groupby(['Week', 'Problem']).size().unstack(fill_value=0)

# print with tabulate
from tabulate import tabulate
print("Problems by Month")
print(tabulate(df_month, headers='keys', tablefmt='pretty', showindex=True))
print("\n\nProblems by Week")
print(tabulate(df_week, headers='keys', tablefmt='pretty', showindex=True))


