import subprocess
import sys
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

print("=" * 50)
print("  🚴 VyaparSync Telegram Bot (Delivery) Launcher")
print("=" * 50)
print("  Starting Delivery Agent bot... Press Ctrl+C to stop.")
print("=" * 50 + "\n")

try:
    subprocess.run(["npx", "tsx", "bot.ts"], check=True, shell=True)
except KeyboardInterrupt:
    print("\n\n🛑 Bot stopped by user.")
    sys.exit(0)
except subprocess.CalledProcessError as e:
    print(f"\n❌ Bot crashed with error code {e.returncode}")
    sys.exit(e.returncode)
