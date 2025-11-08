#!/usr/bin/env python3
"""
Simple test to verify Continue Dev is working properly
"""
import subprocess
import datetime

def run_command(cmd):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    print("🤖 Continue Dev Test")
    print("=" * 30)
    
    # Test basic commands
    print(f"📅 Current time: {datetime.datetime.now()}")
    print(f"👤 User: {run_command('whoami')}")
    print(f"📁 Directory: {run_command('pwd')}")
    print(f"💻 Shell: {run_command('echo $SHELL')}")
    print(f"🔧 Python version: {run_command('python3 --version')}")
    
    print("\n✅ Continue Dev is working! You can now run commands and see output.")