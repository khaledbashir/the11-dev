#!/usr/bin/env python3
import os
import subprocess

# Test various commands
commands = [
    "echo 'hello world'",
    "date",
    "pwd", 
    "whoami",
    "uname -a"
]

print("Testing terminal commands via subprocess:")
print("=" * 50)

for cmd in commands:
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        print(f"Command: {cmd}")
        print(f"Output: {result.stdout.strip()}")
        if result.stderr:
            print(f"Error: {result.stderr.strip()}")
        print("-" * 30)
    except Exception as e:
        print(f"Failed to run {cmd}: {e}")

print("\nAPI Key Status:")
api_key = os.getenv('ANTHROPIC_API_KEY')
if api_key:
    print(f"✅ ANTHROPIC_API_KEY is set: {api_key[:20]}...")
else:
    print("❌ ANTHROPIC_API_KEY is not set")