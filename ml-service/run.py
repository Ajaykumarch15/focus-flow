import os
import sys
from pathlib import Path

# Load .env from ml-service directory
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            os.environ.setdefault(key.strip(), value.strip())

import uvicorn

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8000'))
    uvicorn.run('app.main:app', host='0.0.0.0', port=port, reload=True)
