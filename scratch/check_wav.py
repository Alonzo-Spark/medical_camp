import wave
with wave.open("test_telugu_reminder.wav", "rb") as wf:
    nframes = wf.getnframes()
    rate = wf.getframerate()
    print("Frames:", nframes)
    print("Rate:", rate)
    print("Duration:", nframes / rate)
