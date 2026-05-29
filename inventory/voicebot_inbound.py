import json
import base64
import time
import asyncio
import websockets
import uuid
import audioop
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError
from urllib.parse import urlencode
import io
import wave

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from sarvamai import AsyncSarvamAI, AudioOutput, EventResponse

import os
from dotenv import load_dotenv
load_dotenv()

class Settings:
    """
    =====================================================================
    BOT CONFIGURATION — Edit all voicebot settings here
    =====================================================================
    """
    def __init__(self):
        # ── Sarvam API ────────────────────────────────────────────────
        self.sarvam_api_key = os.getenv("SARVAM_API_KEY", "")

        # ── ASR (Speech-to-Text) ──────────────────────────────────────
        self.sarvam_asr_url = "wss://api.sarvam.ai/speech-to-text-translate/ws"
        self.asr_mode = "transcribe"          # "transcribe" or "translate"
        self.asr_high_vad_sensitivity = True  # Cuts off background noise faster

        # ── TTS (Text-to-Speech) ──────────────────────────────────────
        self.tts_enabled = True
        self.sarvam_tts_model = "bulbul:v2"  # bulbul:v1 or bulbul:v2

        # TTS Voice — Speaker name
        # bulbul:v2 speakers: anushka, abhilash, manisha, vidya, arya, karun, hitesh
        # bulbul:v1 speakers: shubh, anand, meera, etc.
        self.tts_speaker = "anushka"

        # TTS Language code
        # te-IN = Telugu | hi-IN = Hindi | en-IN = English | ta-IN = Tamil
        self.tts_language = "te-IN"

        # TTS Speed / Pace  (0.5 = slow, 1.0 = normal, 1.5 = fast)
        self.tts_pace = 1.0

        # ── Pre-recorded Greeting WAV ─────────────────────────────────
        # This WAV is played immediately when the patient answers the call.
        # Must be: 8kHz, 16-bit, mono PCM (already correct for test_telugu_reminder.wav)
        # Set to None to use TTS greeting instead of a WAV file.
        self.greeting_wav_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "test_telugu_reminder.wav"
        )

        # ── Bot ───────────────────────────────────────────────────────
        self.default_bot_uuid = "bot_f3aaa36d3fe64"

def get_settings():
    return Settings()

class BotRuntimeService:
    async def invoke(self, bot_uuid, user_input, thread_id, caller_number):
        # Telugu response for patient follow-up
        return (
            "మీరు మా వైద్య శిబిరానికి వచ్చినందుకు ధన్యవాదాలు. "
            "మీకు ఏదైనా అనారోగ్యంగా అనిపిస్తుందా? "
            "లేదా ఏదైనా సందేహం ఉంటే చెప్పండి."
        )


class Inbound:
    def __init__(self):
        self.settings = get_settings()
        self.bot_runtime = BotRuntimeService()

        self.sarvam_api_key = self.settings.sarvam_api_key
        self.sarvam_asr_url = self.settings.sarvam_asr_url
        self.sarvam_tts_model = self.settings.sarvam_tts_model

    def _ensure_sarvam_asr_config(self) -> None:
        if not self.sarvam_api_key or not self.sarvam_api_key.strip():
            raise ValueError(
                "Sarvam ASR is not configured: set sarvam_api_key in .env"
            )

        if not self.sarvam_asr_url or not self.sarvam_asr_url.strip():
            raise ValueError(
                "Sarvam ASR websocket URL is not configured: set sarvam_asr_url in .env"
            )
        
    def _pcm16_to_wav_bytes(self, pcm: bytes, sample_rate: int = 16000) -> bytes:
        buffer = io.BytesIO()

        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm)

        return buffer.getvalue()

    async def _stream_wav_to_exotel(self, wav_path: str, stream_sid: str, bot_speaking_event):
        """Stream a pre-recorded WAV file (8kHz, 16-bit, mono) directly to Exotel."""
        try:
            import wave as wave_module
            with wave_module.open(wav_path, "rb") as wf:
                # Validate format
                sr = wf.getframerate()
                ch = wf.getnchannels()
                sw = wf.getsampwidth()
                print(f"Streaming WAV: {wav_path} | {sr}Hz, {ch}ch, {sw*8}bit")

                # If not already 8kHz, convert on the fly with ffmpeg
                if sr != 8000 or ch != 1 or sw != 2:
                    print("WAV needs conversion to 8kHz mono 16-bit, using ffmpeg...")
                    raw_audio = wf.readframes(wf.getnframes())
                    pcm_8k = await self._decode_mp3_to_pcm8k.__func__(self, raw_audio) if False else await self._convert_pcm_to_8k(raw_audio, sr, ch, sw)
                else:
                    pcm_8k = wf.readframes(wf.getnframes())

            # Stream in 20ms frames (160 samples * 2 bytes = 320 bytes at 8kHz)
            frame_size = 320
            frames_sent = 0
            for i in range(0, len(pcm_8k), frame_size):
                frame = pcm_8k[i:i + frame_size]
                if len(frame) < frame_size:
                    break  # skip last partial frame
                from starlette.websockets import WebSocketState
                if self._ws.client_state != WebSocketState.CONNECTED:
                    break
                await self._ws.send_json({
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {
                        "payload": base64.b64encode(frame).decode("ascii"),
                    },
                })
                frames_sent += 1
                await asyncio.sleep(0.02)  # 20ms pacing

            print(f"WAV stream complete: {frames_sent} frames sent")
        except Exception as e:
            import traceback
            print(f"WAV stream error: {e}")
            traceback.print_exc()
        finally:
            bot_speaking_event.clear()

    async def _convert_pcm_to_8k(self, pcm: bytes, src_rate: int, channels: int, sample_width: int) -> bytes:
        """Convert raw PCM to 8kHz mono 16-bit using ffmpeg."""
        fmt = f"s{sample_width * 8}le"
        ffmpeg = await asyncio.create_subprocess_exec(
            "ffmpeg", "-loglevel", "error",
            "-f", fmt, "-ar", str(src_rate), "-ac", str(channels), "-i", "pipe:0",
            "-ac", "1", "-ar", "8000", "-f", "s16le", "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await ffmpeg.communicate(pcm)
        if ffmpeg.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {err.decode()}")
        return out

    async def _speak_and_clear(self, text: str, stream_sid: str, bot_speaking_event):
        """Helper to speak TTS and then release the bot_speaking lock."""
        try:
            await self._sarvam_tts_stream_to_exotel(
                ws=self._ws,
                text=text,
                stream_sid=stream_sid,
                language=self.settings.tts_language,
                speaker=self.settings.tts_speaker,
            )
        except Exception as e:
            print(f"_speak_and_clear error: {e}")
        finally:
            bot_speaking_event.clear()


    async def exotel_inbound(self, ws: WebSocket):
        await ws.accept()
        self._ws = ws  # Store ws reference for _speak_and_clear

        stream_sid = str(uuid.uuid4())
        call_sid = None
        caller_number = None

        # bot_uuid = ws.query_params.get("bot_uuid") or self.settings.default_bot_uuid
        bot_uuid = "bot_f3aaa36d3fe64"

        stopped = asyncio.Event()      
        asr_closed = asyncio.Event()   
        bot_speaking = asyncio.Event() 

        ffmpeg = None

        if not bot_uuid:
            await ws.send_json({
                "event": "error",
                "message": "No bot_uuid provided for inbound Exotel call",
            })
            await ws.close()
            return

        try:
            self._ensure_sarvam_asr_config()

            ffmpeg = await asyncio.create_subprocess_exec(
                "ffmpeg",
                "-loglevel", "error",
                "-f", "s16le",
                "-ar", "8000",
                "-ac", "1",
                "-i", "pipe:0",
                "-ac", "1",
                "-ar", "16000",
                "-f", "s16le",
                "pipe:1",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            headers = {
                "Api-Subscription-Key": self.sarvam_api_key,
            }

            params = urlencode({
                "mode": "transcribe",
                "high_vad_sensitivity": "true",
            })

            separator = "&" if "?" in self.sarvam_asr_url else "?"
            sarvam_asr_url = f"{self.sarvam_asr_url}{separator}{params}"

            print(f"Connecting to Sarvam ASR: {sarvam_asr_url}")

            async with websockets.connect(
                sarvam_asr_url,
                extra_headers=headers,
            ) as sarvam_asr_ws:

                async def receive_from_exotel():
                    nonlocal stream_sid, call_sid, caller_number

                    try:
                        while not stopped.is_set():
                            data = await ws.receive_json()
                            print("EXOTEL OUTPUT:", data)

                            event = data.get("event")

                            if event == "connected":
                                print("Exotel websocket connected")

                            elif event == "start":
                                start = data.get("start", {})

                                stream_sid = (
                                    data.get("stream_sid")
                                    or data.get("streamSid")
                                    or start.get("stream_sid")
                                    or start.get("streamSid")
                                    or stream_sid
                                )

                                call_sid = (
                                    start.get("call_sid")
                                    or start.get("callSid")
                                    or data.get("call_sid")
                                    or data.get("callSid")
                                )

                                caller_number = (
                                    start.get("from")
                                    or start.get("caller")
                                    or data.get("from")
                                    or data.get("caller")
                                )

                                print(
                                    "Exotel stream started: "
                                    f"stream_sid={stream_sid}, call_sid={call_sid}, "
                                    f"caller_number={caller_number}"
                                )

                                # Play greeting from Settings:
                                # - If greeting_wav_path is set, stream the WAV directly
                                # - Otherwise, fall back to TTS greeting
                                bot_speaking.set()
                                if self.settings.greeting_wav_path:
                                    asyncio.create_task(
                                        self._stream_wav_to_exotel(
                                            self.settings.greeting_wav_path,
                                            stream_sid,
                                            bot_speaking
                                        )
                                    )
                                else:
                                    greeting = (
                                        "నమస్కారం! మేము మీకు వైద్య శిబిరం గురించి "
                                        "గుర్తు చేయడానికి ఫోన్ చేస్తున్నాము."
                                    )
                                    asyncio.create_task(
                                        self._speak_and_clear(
                                            greeting, stream_sid, bot_speaking
                                        )
                                    )
                            elif event == "media":
                                if bot_speaking.is_set():
                                    continue

                                if asr_closed.is_set():
                                    continue

                                media = data.get("media", {})
                                payload = media.get("payload")

                                if not payload:
                                    continue

                                try:
                                    pcm_8k = base64.b64decode(payload)
                                except Exception as e:
                                    print(f"Invalid Exotel media payload: {type(e).__name__}: {e}")
                                    continue

                                if ffmpeg and ffmpeg.stdin and not ffmpeg.stdin.is_closing():
                                    ffmpeg.stdin.write(pcm_8k)
                                    await ffmpeg.stdin.drain()

                            elif event == "dtmf":
                                print(f"DTMF received: {data}")

                            elif event == "stop":
                                print(f"Exotel stream stopped: {stream_sid}")
                                stopped.set()
                                break

                            else:
                                print(f"Unknown Exotel event: {event}")

                    except WebSocketDisconnect:
                        print("Exotel websocket disconnected")
                        stopped.set()

                    except RuntimeError as e:
                        print(f"Exotel receive RuntimeError: {e}")
                        stopped.set()

                    except Exception as e:
                        print(f"Error receiving from Exotel: {type(e).__name__}: {e}")
                        stopped.set()

                    finally:
                        try:
                            if ffmpeg and ffmpeg.stdin and not ffmpeg.stdin.is_closing():
                                ffmpeg.stdin.close()
                        except Exception:
                            pass

                async def send_pcm_to_sarvam_asr():
                    print("Sending chunks to Sarvam ASR.")

                    try:
                        while not stopped.is_set() and not asr_closed.is_set():
                            if not ffmpeg or not ffmpeg.stdout:
                                print("ffmpeg stdout unavailable")
                                asr_closed.set()
                                break
                            
                            pcm_16k = await ffmpeg.stdout.read(3200)

                            if not pcm_16k:
                                print("ffmpeg stdout ended")
                                break
                            
                            await sarvam_asr_ws.send(json.dumps({
                                "audio": {
                                    "data": base64.b64encode(pcm_16k).decode("utf-8"),
                                    "sample_rate": 16000,
                                    "encoding": "audio/wav",
                                }
                            }))

                            print(f"Sent PCM chunk to Sarvam: {len(pcm_16k)} bytes")

                    except ConnectionClosedOK as e:
                        print(
                            "Sarvam ASR sender closed normally: "
                            f"code={e.code}, reason={e.reason}"
                        )
                        asr_closed.set()

                    except ConnectionClosedError as e:
                        print(
                            "Sarvam ASR sender closed with error: "
                            f"code={e.code}, reason={e.reason}"
                        )
                        asr_closed.set()

                    except Exception as e:
                        print(f"Error sending audio to Sarvam ASR: {type(e).__name__}: {e}")
                        asr_closed.set()

                async def receive_transcript_from_sarvam():
                    nonlocal call_sid, stream_sid, caller_number

                    print("Receiving transcript from Sarvam ASR.")

                    try:
                        async for message in sarvam_asr_ws:
                            print("SARVAM RAW:", message)

                            if stopped.is_set():
                                break

                            try:
                                data = json.loads(message)
                            except Exception as e:
                                print(f"Invalid Sarvam JSON: {type(e).__name__}: {e}")
                                continue

                            msg_type = data.get("type")

                            transcript = (
                                data.get("data", {}).get("transcript")
                                or data.get("transcript")
                                or data.get("text")
                            )

                            is_final = (
                                data.get("data", {}).get("is_final")
                                or data.get("is_final")
                                or data.get("final")
                                or msg_type == "data"
                            )

                            if not transcript:
                                continue

                            print(f"Sarvam transcript: {transcript}, final={is_final}")

                            if not is_final:
                                continue

                            # Final user utterance received. Now call bot sequentially.
                            thread_id = call_sid or stream_sid

                            bot_speaking.set()

                            try:
                                agent_response = await self.bot_runtime.invoke(
                                    bot_uuid=bot_uuid,
                                    user_input=transcript,
                                    thread_id=thread_id,
                                    caller_number=caller_number,
                                )

                                response_text = self._extract_text(agent_response)

                                print(f"Bot response text: {response_text}")
                                print(f"TTS check: response_text={response_text!r}, stream_sid={stream_sid!r}")
                                if response_text and stream_sid:
                                    await self._sarvam_tts_stream_to_exotel(
                                        ws=ws,
                                        text=response_text,
                                        stream_sid=stream_sid,
                                        language="te-IN",
                                        speaker="anushka",
                                    )

                            except Exception as e:
                                print(f"Bot/TTS error: {type(e).__name__}: {e}")

                            finally:
                                bot_speaking.clear()

                    except ConnectionClosedOK as e:
                        print(
                            "Sarvam ASR receiver closed normally: "
                            f"code={e.code}, reason={e.reason}"
                        )
                        asr_closed.set()

                    except ConnectionClosedError as e:
                        print(
                            "Sarvam ASR receiver closed with error: "
                            f"code={e.code}, reason={e.reason}"
                        )
                        asr_closed.set()

                    except Exception as e:
                        print(f"Error receiving Sarvam transcript: {type(e).__name__}: {e}")
                        asr_closed.set()

                await asyncio.gather(
                    receive_from_exotel(),
                    send_pcm_to_sarvam_asr(),
                    receive_transcript_from_sarvam(),
                )

        except Exception as e:
            print(f"Exotel inbound error: {type(e).__name__}: {e}")

            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.send_json({
                        "event": "error",
                        "message": str(e),
                    })
                except Exception:
                    pass

        finally:
            stopped.set()

            try:
                if ffmpeg and ffmpeg.stdin and not ffmpeg.stdin.is_closing():
                    ffmpeg.stdin.close()
            except Exception:
                pass

            try:
                if ffmpeg:
                    ffmpeg.kill()
            except Exception:
                pass

            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.close()
                except Exception:
                    pass

    async def _decode_mp3_to_pcm8k(self, mp3_bytes: bytes) -> bytes:
        ffmpeg = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-loglevel", "error",
            "-f", "mp3",
            "-i", "pipe:0",
            "-ac", "1",
            "-ar", "8000",
            "-f", "s16le",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        pcm_8k, stderr = await ffmpeg.communicate(mp3_bytes)

        if ffmpeg.returncode != 0:
            raise RuntimeError(
                f"ffmpeg MP3 decode failed: {stderr.decode(errors='ignore')}"
            )

        return pcm_8k


    async def _sarvam_tts_stream_to_exotel(
        self,
        ws: WebSocket,
        text: str,
        stream_sid: str,
        language: str = "en-IN",
        speaker: str = "shubh",
    ):
        print(
            f"TTS called: text={text!r}, "
            f"tts_enabled={self.settings.tts_enabled}, "
            f"stream_sid={stream_sid!r}, "
            f"model={self.sarvam_tts_model!r}"
        )

        if not text:
            print("TTS skipped: empty text")
            return

        if not self.settings.tts_enabled:
            print("TTS skipped: tts_enabled is false")
            return

        if not stream_sid:
            print("TTS skipped: missing stream_sid")
            return

        try:
            client = AsyncSarvamAI(api_subscription_key=self.sarvam_api_key)

            mp3_chunks = []

            async with client.text_to_speech_streaming.connect(
                model=self.sarvam_tts_model,
                send_completion_event=True,
            ) as sarvam_tts_ws:

                print("Connected to Sarvam TTS WebSocket")

                await sarvam_tts_ws.configure(
                    target_language_code=language,
                    speaker=speaker,
                )

                print("Configured Sarvam TTS")

                await sarvam_tts_ws.convert(text)
                print("Sent text to Sarvam TTS")

                await sarvam_tts_ws.flush()
                print("Flushed Sarvam TTS")

                async for message in sarvam_tts_ws:
                    print("SARVAM TTS RAW:", type(message), message)

                    if ws.client_state != WebSocketState.CONNECTED:
                        print("Exotel WS disconnected during TTS")
                        return

                    if isinstance(message, AudioOutput):
                        content_type = getattr(message.data, "content_type", None)
                        audio_b64 = getattr(message.data, "audio", None)

                        print("TTS content_type:", content_type)

                        if not audio_b64:
                            print("Empty Sarvam TTS audio payload")
                            continue

                        audio_bytes = base64.b64decode(audio_b64)

                        if not audio_bytes:
                            print("Decoded Sarvam TTS audio is empty")
                            continue

                        if content_type == "audio/mpeg":
                            mp3_chunks.append(audio_bytes)
                            print(f"Collected MP3 chunk: {len(audio_bytes)} bytes")
                        else:
                            print(
                                f"Unexpected Sarvam TTS content_type={content_type!r}. "
                                "This code currently expects audio/mpeg."
                            )

                    elif isinstance(message, EventResponse):
                        event_type = getattr(message.data, "event_type", None)
                        print("Received TTS event:", event_type)

                        if event_type == "final":
                            break

                    else:
                        print("Unknown Sarvam TTS message type:", type(message))

            if not mp3_chunks:
                print("No Sarvam TTS MP3 chunks received")
                return

            mp3_bytes = b"".join(mp3_chunks)

            print(f"Total Sarvam MP3 bytes: {len(mp3_bytes)}")

            pcm_8k = await self._decode_mp3_to_pcm8k(mp3_bytes)

            print(f"Decoded PCM 8k bytes: {len(pcm_8k)}")

            if not pcm_8k:
                print("Decoded PCM is empty")
                return

            # Exotel expects 8 kHz, 16-bit, mono PCM frames.
            # 20 ms at 8 kHz = 160 samples.
            # 160 samples * 2 bytes = 320 bytes.
            frame_size = 320
            seq = 1

            for i in range(0, len(pcm_8k), frame_size):
                frame = pcm_8k[i:i + frame_size]

                if len(frame) < frame_size:
                    print(f"Dropping final partial frame: {len(frame)} bytes")
                    break

                if ws.client_state != WebSocketState.CONNECTED:
                    print("Exotel WS disconnected while sending TTS audio")
                    return

                msg = {
                    "event": "media",
                    "streamSid": stream_sid,
                    "media": {
                        "payload": base64.b64encode(frame).decode("ascii"),
                    },
                }

                await ws.send_json(msg)

                print(f"Sent TTS frame to Exotel: seq={seq}, bytes={len(frame)}")

                seq += 1

                # Pace audio in real time: each frame is 20 ms.
                await asyncio.sleep(0.02)

            print("Finished sending TTS audio to Exotel")

        except Exception as e:
            import traceback
            print(f"TTS error: {type(e).__name__}: {e}")
            traceback.print_exc()

    def _chunk_pcm_frames(
        self,
        pcm: bytes,
        sr: int = 8000,
        frame_ms: int = 20,
    ):
        frame_size = int(sr * frame_ms / 1000) * 2

        for i in range(0, len(pcm), frame_size):
            frame = pcm[i:i + frame_size]

            if len(frame) == frame_size:
                yield frame

    def _extract_text(self, response) -> str:
        if response is None:
            return ""

        if isinstance(response, str):
            return response

        if isinstance(response, dict):
            return (
                response.get("response")
                or response.get("answer")
                or response.get("text")
                or response.get("message")
                or ""
            )

        return str(response)