import os

def cls():
    """Clear the console screen."""
    os.system('cls' if os.name == 'nt' else 'clear')