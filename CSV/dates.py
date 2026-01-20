import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta, time

# -1 = ?
#  0 = X
#  1 = within done
#  2 = ✅ 
#  3 = - (skipped)

# Part One 
# Clear the console 
import os
import platform
if platform.system() == "Windows":
    os.system('cls')
else:
        os.system('clear')

# Part Two 
# region
# Read the csv file 
df_original = pd.read_csv('Checkmarks.csv')
#          Date  Going sleep  Wake up  Reach out  Exercise reminder  Sort Towels  ...  Family photo  mL of Water  Habits Data Analytics  Mass  Day Mood  Unnamed: 109
# 0  2025-04-30           -1     8300          1                 -1           -1  ...            -1           -1                      2    -1        -1           NaN
# 1  2025-04-29         1150     9450          1                 -1           -1  ...            -1           -1                      1    -1      4000           NaN
# 2  2025-04-28         1150    12450          1                 -1           -1  ...            -1           -1                      1    -1      3000           NaN
# 3  2025-04-27         3150     9300          1                 -1           -1  ...            -1           -1                      1     0      3000           NaN
# 4  2025-04-26         2300    11150          1                 -1           -1  ...            -1           -1                      1     1      3000           NaN

# Make a copy with the columns of interest
focus = [ 'Date', 'Wake up', 'First Meal', 'Second Meal', 'Third Meal', 'Going sleep']
df = df_original[focus].copy()
#          Date  Wake up  First Meal  Second Meal  Third Meal  Going sleep
# 0  2025-04-30     8300       14150           -1          -1           -1
# 1  2025-04-29     9450       11300        14450          -1         1150
# 2  2025-04-28    12450       15000        21300          -1         1150
# 3  2025-04-27     9300       12000        22300          -1         3150
# 4  2025-04-26    11150       13450        20450          -1         2300
# print(df['Date'].head())


# Turn Date column to datetime

# Before:
# 0    2025-04-30
# 1    2025-04-29
# 2    2025-04-28
# 3    2025-04-27
# 4    2025-04-26
# Name: Date, dtype: object

df['Date'] = pd.to_datetime(df['Date'])

# After:
# 0   2025-04-30
# 1   2025-04-29
# 2   2025-04-28
# 3   2025-04-27
# 4   2025-04-26
# Name: Date, dtype: datetime64[ns]
#endregion


# Part Three 
#region
time_columns = ['Wake up', 'First Meal', 'Second Meal', 'Third Meal', 'Going sleep']

for col in time_columns:

    # print(df[df[time_columns].isin([3]).any(axis=1)])
    #           Date  Wake up  First Meal  Second Meal  Third Meal  Going sleep
    # 37  2025-03-24     9000       12300        20150           3        22300
    # 85  2025-02-04     9150       15150        20000           3        22450
    # 158 2024-11-23    12300       15300         2300           3         5000
    # 191 2024-10-21    11300       16000        20150           3         2000
    # 197 2024-10-15     7450       10000        20000           3         2300

    # Turn 3 to -1 --> This is because there is the option in the app to skip
    # IN THIS CASE skipping is equivalent to missing
    df[col] = df[col].replace(3, -1)
    #           Date  Wake up  First Meal  Second Meal  Third Meal  Going sleep
    # 37  2025-03-24     9000       12300        20150          -1        22300
    # 85  2025-02-04     9150       15150        20000          -1        22450
    # 158 2024-11-23    12300       15300         2300          -1         5000
    # 191 2024-10-21    11300       16000        20150          -1         2000
    # 197 2024-10-15     7450       10000        20000          -1         2300

    # Turn -1 to NA
    # Take the values if they are greater than or equal to 0, otherwise set it to NA  
    # This is because the hours start at 0 and go to 23, so if the value is less than 0, it is not a valid hour
    df[col] = df[col].apply(lambda x: x if x >= 0 else pd.NA)
    #           Date  Wake up  First Meal  Second Meal  Third Meal  Going sleep
    # 37  2025-03-24     9000       12300        20150        <NA>        22300
    # 85  2025-02-04     9150       15150        20000        <NA>        22450
    # 158 2024-11-23    12300       15300         2300        <NA>         5000
    # 191 2024-10-21    11300       16000        20150        <NA>         2000
    # 197 2024-10-15     7450       10000        20000        <NA>         2300

    # Divide by 10 to have military time and keep as int
    df[col] = (df[col] / 10).astype('Int64')
    #           Date  Wake up  First Meal  Second Meal  Third Meal  Going sleep
    # 37  2025-03-24      900        1230         2015        <NA>         2230
    # 85  2025-02-04      915        1515         2000        <NA>         2245
    # 158 2024-11-23     1230        1530          230        <NA>          500
    # 191 2024-10-21     1130        1600         2015        <NA>          200
    # 197 2024-10-15      745        1000         2000        <NA>          230
# endregion

# Part Four 
# region
# Create a new column with the time of each time_column merged with the Date column and convert to datetime
for col in time_columns:
    df[col + ' DT'] = df.apply(
        lambda row: None 
        if pd.isna(row[col]) 
        else datetime.combine(
            row['Date'], 
            time(hour=row[col] // 100, minute=row[col] % 100)),
            axis=1)
DTfocus = ['Wake up DT', 'First Meal DT', 'Second Meal DT', 'Third Meal DT', 'Going sleep DT']
#              Wake up DT       First Meal DT      Second Meal DT Third Meal DT      Going sleep DT
# 37  2025-03-24 09:00:00 2025-03-24 12:30:00 2025-03-24 20:15:00           NaT 2025-03-24 22:30:00
# 85  2025-02-04 09:15:00 2025-02-04 15:15:00 2025-02-04 20:00:00           NaT 2025-02-04 22:45:00
# 158 2024-11-23 12:30:00 2024-11-23 15:30:00 2024-11-23 02:30:00           NaT 2024-11-23 05:00:00
# 191 2024-10-21 11:30:00 2024-10-21 16:00:00 2024-10-21 20:15:00           NaT 2024-10-21 02:00:00
# 197 2024-10-15 07:45:00 2024-10-15 10:00:00 2024-10-15 20:00:00           NaT 2024-10-15 02:30:00
# endregion

# Part Five
# region
# A problem arises when the time of an event is earlier than the previous event on the same day.
#             Wake up DT       First Meal DT      Second Meal DT       Third Meal DT      Going sleep DT
# 11 2025-04-19 11:45:00 2025-04-19 15:45:00 2025-04-19 22:00:00                 NaT 2025-04-19 00:00:00
# 12 2025-04-18 12:00:00 2025-04-18 14:45:00 2025-04-18 21:00:00 2025-04-18 01:15:00 2025-04-18 03:15:00

# Fixing sequential timing: if an event time is earlier than the previous event, add one day
def fix_sequential_timing(row):
    """
    Fix datetime sequence by adding a day when an event occurs before the previous event
    """
    events = []
    for col in DTfocus:
        if pd.notna(row[col]):
            events.append(row[col])
        else:
            events.append(None)

    # Start from the second event since the first event has no previous event to compare with
    for i in range(1, len(events)): 
        # check that the current and previous events are not None
        if events[i] is not None and events[i-1] is not None:
            # If current event  is earlier than previous event, add one day
            if events[i] < events[i-1]:
                events[i] = events[i] + timedelta(days=1)
        elif events[i] is not None and i > 0:
            # If previous event is None, check against the last non-None event
            last_valid_idx = None
            for j in range(i-1, -1, -1):
                if events[j] is not None:
                    last_valid_idx = j
                    break
            
            if last_valid_idx is not None and events[i] < events[last_valid_idx]:
                events[i] = events[i] + timedelta(days=1)
    
    return pd.Series(events, index=DTfocus)

# Apply the fix to each row
df[DTfocus] = df.apply(fix_sequential_timing, axis=1)
# 11 2025-04-19 11:45:00 2025-04-19 15:45:00 2025-04-19 22:00:00                 NaT 2025-04-20 00:00:00
# 12 2025-04-18 12:00:00 2025-04-18 14:45:00 2025-04-18 21:00:00 2025-04-19 01:15:00 2025-04-19 03:15:00
# endregion

# Part Six
# Up until now, the data is ready to be used for date analysis.
# A new column is created to calculate the time difference between 'Going sleep' and 'Wake up'
df['Time Awake (HH:MM)'] = df['Going sleep DT'] - df['Wake up DT']
print(df[['Date', 'Wake up DT', 'Going sleep DT', 'Time Awake (HH:MM)']].head(15))

# print data type of 'Time Awake (HH:MM)' column
print(df['Time Awake (HH:MM)'].dtype)

df['Time Awake (HH.MM)'] = df['Time Awake (HH:MM)'].apply(lambda x: x.total_seconds() / 3600 if pd.notna(x) else None)
print(df[['Date', 'Wake up DT', 'Going sleep DT', 'Time Awake (HH.MM)']].head(15))
