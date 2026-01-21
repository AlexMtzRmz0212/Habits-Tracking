import pandas as pd
from datetime import datetime, time, timedelta

class HabitCleaner:
    def __init__(self):
        self.time_columns = ['Wake up', 'First Meal', 'Second Meal', 
                           'Third Meal', 'Going sleep']
    
    def clean_csv_data(self, df):
        """Your dates.py logic as reusable functions."""
        df_clean = df.copy()
        
        # 1. Convert Date
        df_clean['Date'] = pd.to_datetime(df_clean['Date'])
        
        # 2. Clean time columns
        df_clean = self._clean_time_values(df_clean)
        
        # 3. Create datetime columns
        df_clean = self._create_datetime_columns(df_clean)
        
        # 4. Fix time sequences
        df_clean = self._fix_time_sequences(df_clean)
        
        # 5. Calculate derived metrics
        df_clean = self._calculate_metrics(df_clean)
        
        return df_clean
    
    def _clean_time_values(self, df):
        """Convert 3→-1→NA, divide by 10."""
        for col in self.time_columns:
            df[col] = df[col].replace(3, -1)
            df[col] = df[col].apply(lambda x: x if x >= 0 else pd.NA)
            df[col] = (df[col] / 10).astype('Int64')
        return df
    
    def _create_datetime_columns(self, df):
        """Merge Date with time columns."""
        for col in self.time_columns:
            dt_col = col + '_DT'
            df[dt_col] = df.apply(
                lambda row: None if pd.isna(row[col]) else 
                datetime.combine(row['Date'].date(), 
                               time(hour=row[col]//100, minute=row[col]%100)),
                axis=1
            )
        return df
    
    def _fix_time_sequences(self, df):
        """Your sequential timing fix."""
        dt_cols = [col + '_DT' for col in self.time_columns]
        
        for idx, row in df.iterrows():
            events = []
            for col in dt_cols:
                events.append(row[col])
            
            for i in range(1, len(events)):
                if pd.notna(events[i]) and pd.notna(events[i-1]):
                    if events[i] < events[i-1]:
                        events[i] += timedelta(days=1)
            
            df.loc[idx, dt_cols] = events
        return df
    
    def _calculate_metrics(self, df):
        """Calculate time awake, sleep duration, etc."""
        if 'Wake up_DT' in df.columns and 'Going sleep_DT' in df.columns:
            df['Time_Awake'] = df['Going sleep_DT'] - df['Wake up_DT']
            df['Sleep_Hours'] = df['Time_Awake'].dt.total_seconds() / 3600
        return df
    
    def categorize_habits(self, df):
        """Group 150+ habits into categories."""
        # Binary vs continuous
        binary_habits = []
        continuous_habits = []
        
        for col in df.columns:
            if col not in ['Date'] + self.time_columns:
                unique_vals = df[col].dropna().unique()
                if set(unique_vals).issubset({-1, 0, 1, 2, 3}):
                    binary_habits.append(col)
                else:
                    continuous_habits.append(col)
        
        return {
            'binary': binary_habits,
            'continuous': continuous_habits,
            'time_based': self.time_columns
        }