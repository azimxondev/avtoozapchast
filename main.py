"""
Auto Sklad — Production Entry Point for Render
Allows Render to seamlessly start the app with either:
`python main.py` or `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
"""

import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"[RENDER] Auto Sklad ishga tushmoqda, port: {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
