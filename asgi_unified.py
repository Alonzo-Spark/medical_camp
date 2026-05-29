from fastapi import FastAPI, WebSocket
from django.core.asgi import get_asgi_application
import os
from dotenv import load_dotenv

# 1. Load environment variables first!
load_dotenv()

# 2. Load Django Configuration
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')

# Initialize Django ASGI application
django_app = get_asgi_application()

# 2. Load FastAPI
from contextlib import asynccontextmanager
import asyncio
from inventory.exotel_retry_task import exotel_retry_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background task
    task = asyncio.create_task(exotel_retry_loop())
    yield
    # Cancel task on shutdown
    task.cancel()

app = FastAPI(title="Voicebot & Medical Camp Backend", lifespan=lifespan)

# 3. Mount your Exotel WebSocket Route
from inventory.voicebot_inbound import Inbound

@app.websocket("/ws/exotel_inbound")
async def websocket_endpoint(ws: WebSocket):
    print("New WebSocket connection attempting on /ws/exotel_inbound")
    inbound = Inbound()
    await inbound.exotel_inbound(ws)

# 4. Mount Django to handle all normal HTTP traffic
app.mount("/", django_app)
