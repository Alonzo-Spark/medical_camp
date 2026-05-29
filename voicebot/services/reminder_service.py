import os
import datetime
from django.utils import timezone
from voicebot.models import CallSchedule, CampVoiceReminder
from voicebot.services.tts_service import SarvamTTSService

LETTER_PHONETICS = {
    'A': 'ఏ', 'B': 'బీ', 'C': 'సీ', 'D': 'డీ', 'E': 'ఈ', 'F': 'ఎఫ్', 'G': 'జీ',
    'H': 'హెచ్', 'I': 'ఐ', 'J': 'జే', 'K': 'కే', 'L': 'ఎల్', 'M': 'ఎమ్', 'N': 'ఎన్',
    'O': 'ఓ', 'P': 'పీ', 'Q': 'క్యూ', 'R': 'ఆర్', 'S': 'ఎస్', 'T': 'టీ', 'U': 'యూ',
    'V': 'వీ', 'W': 'డబ్ల్యూ', 'X': 'ఎక్స్', 'Y': 'వై', 'Z': 'జెడ్'
}

def format_acronyms_to_telugu(text: str) -> str:
    """
    Converts English uppercase acronyms (like KPHB, CCC) into their phonetic Telugu spellings.
    """
    words = text.split()
    formatted_words = []
    for word in words:
        # Clean word from punctuation for checking
        clean_word = "".join(c for c in word if c.isalnum())
        if clean_word.isupper() and clean_word.isalpha() and len(clean_word) > 1:
            translated_letters = [LETTER_PHONETICS.get(char, char) for char in clean_word]
            formatted_words.append(" ".join(translated_letters))
        else:
            formatted_words.append(word)
    return " ".join(formatted_words)

TELUGU_DAYS_ORDINAL = {
    1: "ఒకటవ", 2: "రెండవ", 3: "మూడవ", 4: "నాలుగవ", 5: "ఐదవ",
    6: "ఆరవ", 7: "ఏడవ", 8: "ఎనిమిదవ", 9: "తొమ్మిదవ", 10: "పదవ",
    11: "పదకొండవ", 12: "పన్నెండవ", 13: "పదమూడవ", 14: "పదనాలుగవ", 15: "పదిహేనవ",
    16: "పదహారవ", 17: "పదిహేడవ", 18: "పద్దెనిమిదవ", 19: "పంతొమ్మిదవ", 20: "ఇరవయ్యవ",
    21: "ఇరవై ఒకటవ", 22: "ఇరవై రెండవ", 23: "ఇరవై మూడవ", 24: "ఇరవై నాలుగవ", 25: "ఇరవై ఐదవ",
    26: "ఇరవై ఆరవ", 27: "ఇరవై ఏడవ", 28: "ఇరవై ఎనిమిదవ", 29: "ఇరవై తొమ్మిదవ", 30: "ముప్పైయవ",
    31: "ముప్పై ఒకటవ"
}

def format_year_to_telugu(year: int) -> str:
    year_map = {
        2024: "రెండు వేల ఇరవై నాలుగు",
        2025: "రెండు వేల ఇరవై ఐదు",
        2026: "రెండు వేల ఇరవై ఆరు",
        2027: "రెండు వేల ఇరవై ఏడు",
        2028: "రెండు వేల ఇరవై ఎనిమిది",
        2029: "రెండు వేల ఇరవై తొమ్మిది",
        2030: "రెండు వేల ముప్పై"
    }
    return year_map.get(year, str(year))

def format_date_for_telugu_tts(date_val) -> str:
    """
    Converts a date into a natural Telugu phrasing using phonetic Telugu words.
    """
    if isinstance(date_val, str):
        try:
            date_val = datetime.datetime.strptime(date_val, "%Y-%m-%d").date()
        except ValueError:
            try:
                date_val = datetime.datetime.strptime(date_val, "%d-%m-%Y").date()
            except ValueError:
                return date_val

    months_te = {
        1: "జనవరి", 2: "ఫిబ్రవరి", 3: "మార్చి", 4: "ఏప్రిల్", 5: "మే", 6: "జూన్",
        7: "జూలై", 8: "ఆగస్టు", 9: "సెప్టెంబరు", 10: "అక్టోబరు", 11: "నవంబరు", 12: "డిసెంబరు"
    }
    
    day_word = TELUGU_DAYS_ORDINAL.get(date_val.day, f"{date_val.day}వ")
    month_name = months_te.get(date_val.month, "")
    year_word = format_year_to_telugu(date_val.year)
    
    return f"{month_name} {day_word} తేదీ, {year_word}"



def translate_venue_to_telugu(venue_name: str) -> str:
    """
    Translates common English venue names phonetically into Telugu script for clear TTS pronunciation.
    Using spaces between words (e.g. పద్మా రావు) ensures the TTS engine pronounces the segments correctly.
    """
    normalized = " ".join(venue_name.lower().split())
    
    mappings = {
        "padmaraonagar": "పద్మా రావు నగర్",
        "padmarao nagar": "పద్మా రావు నగర్",
        "padma rao nagar": "పద్మా రావు నగర్",
        "kphb": "కే పీ హెచ్ బీ",
        "miyapur": "మియాపూర్",
        "nizampet": "నిజాంపేట్",
        "ss function hall": "ఎస్ ఎస్ ఫంక్షన్ హాల్",
        "default venue": "డిఫాల్ట్ వేదిక",
        "test venue name": "టెస్ట్ వేదిక",
    }
    
    return mappings.get(normalized, format_acronyms_to_telugu(venue_name))


class ReminderService:
    def __init__(self):
        self.tts = SarvamTTSService()

    def generate_telugu_text(self, date_val, venue_name: str) -> str:
        """
        Generates natural, phonetically accurate Telugu text for TTS.
        """
        formatted_date = format_date_for_telugu_tts(date_val)
        formatted_venue = translate_venue_to_telugu(venue_name)
        
        return f"నమస్కారం, మేము సీ సీ సీ మెడికల్ క్యాంప్ నుండి మాట్లాడుతున్నాము. మన తదుపరి మెడికల్ క్యాంప్ {formatted_date}న, {formatted_venue} వద్ద జరుగుతుంది. దయచేసి హాజరుకాగలరు. ధన్యవాదాలు."

    def process_and_generate_audio(self, schedule_id: int) -> CallSchedule:
        """
        Processes a call schedule. Reuses the camp-wide audio reminder if it already
        exists as a valid 8kHz WAV file and matches the current text. Otherwise regenerates it.
        """
        schedule = CallSchedule.objects.get(id=schedule_id)
        schedule.status = 'processing'
        schedule.save()

        try:
            camp = schedule.camp
            reminder, created = CampVoiceReminder.objects.get_or_create(camp=camp)
            telugu_text = self.generate_telugu_text(camp.date, camp.venue.name)

            # Determine if we need to (re)generate the audio:
            # - First time (created = True)
            # - No audio file saved yet
            # - Audio file is old .mp3 format (not Exotel-compatible .wav)
            # - The template text or pronunciation dictionary has changed
            needs_generation = (
                created
                or not reminder.audio_file
                or not reminder.audio_file.name.endswith('.wav')
                or reminder.telugu_text != telugu_text
            )

            if needs_generation:
                # Delete old incompatible file from disk if it exists
                if reminder.audio_file:
                    try:
                        old_path = reminder.audio_file.path
                        import os
                        if os.path.exists(old_path):
                            os.remove(old_path)
                            print(f"[Reminder] Deleted old audio: {old_path}")
                    except Exception as del_err:
                        print(f"[Reminder] Could not delete old audio: {del_err}")
                    reminder.audio_file = None
                    reminder.save()

                # Generate fresh 8kHz WAV audio
                print(f"[Reminder] Generating new WAV audio for camp {camp.number}...")
                telugu_text = self.generate_telugu_text(camp.date, camp.venue.name)
                audio_file = self.tts.synthesize_telugu(telugu_text)
                filename = f"camp_reminder_{camp.id}.wav"
                reminder.telugu_text = telugu_text
                reminder.audio_file.save(filename, audio_file, save=True)
                print(f"[Reminder] Saved: {filename}")
            else:
                print(f"[Reminder] Reusing existing WAV for camp {camp.number}: {reminder.audio_file.name}")

            # Link the camp-wide audio to the individual schedule record
            schedule.audio_file = reminder.audio_file
            schedule.status = 'completed'
            schedule.save()
            return schedule

        except Exception as e:
            schedule.status = 'failed'
            schedule.save()
            raise e

