# Habits-Tracking
Exploratory Data Analysis, visualization, and predictive modeling of personal habit data exported from the Loop Habit Tracker app.

SQLite as primary (more portable, SQL practice)

CSV as backup/alternative

Structure for portfolio showcase:

```
Habits-Tracking/
├── data/
│   ├── raw/            # Manually impoerted files
│   └── processed/      # Cleaned versions
├── notebooks/          # Jupyter for exploration
├── old/                # Previous Tests
├── src/
│   ├── database.py     # SQL operations
│   ├── etl.py          # Cleaning pipeline
│   ├── analytics.py    # Statistical analysis
│   ├── dashboard.py    # Plotly/PowerBI integration
│   └── ml.py           # Predictive models
├── docs/               # Documentation
└── README.md           # Project showcase
```
Key Features:

SQL: Query habit trends, correlations

Python: Automated cleaning pipeline (time-fixing logic)

Visualization: Tableau/PowerBI dashboards showing habit streaks, patterns

ML: Predict habit completion, detect anomalies

Workflow for Portfolio Project:

1. Data Ingestion (Manual → Automated)

```
data/
├── raw/
│   ├── Loop Habits CSV YYYY-MM-DD/
│   │   ├── Checkmarks.csv
│   │   └── [001-150] Habit/
│   │       └── Checkmarcs.csv
│   └── Loop Habits Backup YYYY-MM-DD ######.db
└── processed/
```

Script to auto-process new exports in data/raw/

Detect format (.csv or .db) and load

2. Cleaning Pipeline (Reusable)

time-fixing logic as a function
def fix_time_sequence(df): ...
def categorize_habits(df): ...  # 150 habits → groups

3. SQL Database (Show SQL skills)

Store cleaned data in SQLite

Write queries for analysis

4. Analysis Layers:

Level 1: Basic Stats (completion rates, streaks)
Level 2: Time Patterns (sleep, meals correlations)
Level 3: ML Models (predict missing habits, clusters)

5. Visualization Portfolio:

Tableau: Interactive habit calendar

Power BI: Progress dashboards

Python (Plotly): Custom analytics

6. Documentation

README with problem/solution

SQL query examples

Visualization samples