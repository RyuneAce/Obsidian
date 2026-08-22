import subprocess
import sys
import os

# Change to the telegram-bot directory (works even if run from parent folder)
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Windows consoles often default to cp1252; ensure emoji output works
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

print("=" * 45)
print("  🤖 VyaparSync Telegram Bot (Customer) Launcher")
print("=" * 45)
print("  Starting Customer bot... Press Ctrl+C to stop.")
print("=" * 45 + "\n")

try:
    subprocess.run(["npx", "tsx", "bot.ts"], check=True, shell=True)
except KeyboardInterrupt:
    print("\n\n🛑 Bot stopped by user.")
    sys.exit(0)
except subprocess.CalledProcessError as e:
    print(f"\n❌ Bot crashed with error code {e.returncode}")
    sys.exit(e.returncode)
