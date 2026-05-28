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

def format_date_for_telugu_tts(date_val) -> str:
    """
    Converts a date into a natural Telugu phrasing (e.g. 02-06-2026 becomes 2వ తేదీ జూన్, 2026).
    """
    if isinstance(date_val, str):
        try:
            # Parse YYYY-MM-DD
            date_val = datetime.datetime.strptime(date_val, "%Y-%m-%d").date()
        except ValueError:
            try:
                # Parse DD-MM-YYYY
                date_val = datetime.datetime.strptime(date_val, "%d-%m-%Y").date()
            except ValueError:
                return date_val  # Return as-is if parsing fails

    months_te = {
        1: "జనవరి",
        2: "ఫిబ్రవరి",
        3: "మార్చి",
        4: "ఏప్రిల్",
        5: "మే",
        6: "జూన్",
        7: "జూలై",
        8: "ఆగస్టు",
        9: "సెప్టెంబరు",
        10: "అక్టోబరు",
        11: "నవంబరు",
        12: "డిసెంబరు"
    }
    
    day = date_val.day
    month_name = months_te.get(date_val.month, "")
    year = date_val.year
    
    return f"{day}వ తేదీ {month_name}, {year}"


class ReminderService:
    def __init__(self):
        self.tts = SarvamTTSService()

    def generate_telugu_text(self, date_val, venue_name: str) -> str:
        """
        Generates natural, phonetically accurate Telugu text for TTS.
        """
        formatted_date = format_date_for_telugu_tts(date_val)
        formatted_venue = format_acronyms_to_telugu(venue_name)
        
        return f"నమస్కారం, మేము సీ సీ సీ మెడికల్ క్యాంప్ నుండి కాల్ చేస్తున్నాము. మీ తదుపరి మెడికల్ క్యాంప్ {formatted_date}న {formatted_venue} వద్ద జరుగుతుంది. దయచేసి హాజరుకాగలరు. ధన్యవాదాలు."

    def process_and_generate_audio(self, schedule_id: int) -> CallSchedule:
        """
        Processes a call schedule. Reuses the camp-wide audio reminder if it exists.
        Otherwise, generates it dynamically and saves it for subsequent reuse.
        """
        schedule = CallSchedule.objects.get(id=schedule_id)
        schedule.status = 'processing'
        schedule.save()

        try:
            # Check if there is already a generated reminder audio for this camp
            camp = schedule.camp
            reminder, created = CampVoiceReminder.objects.get_or_create(camp=camp)
            
            if created or not reminder.audio_file:
                # Generate new camp-wide reminder audio
                telugu_text = self.generate_telugu_text(camp.date, camp.venue.name)
                
                audio_file = self.tts.synthesize_telugu(telugu_text)
                filename = f"camp_reminder_{camp.id}.mp3"
                reminder.telugu_text = telugu_text
                reminder.audio_file.save(filename, audio_file, save=True)
                
            # Assign the camp-wide audio file reference to the individual schedule record
            schedule.audio_file = reminder.audio_file
            schedule.status = 'completed'
            schedule.save()
            return schedule

        except Exception as e:
            schedule.status = 'failed'
            schedule.save()
            raise e
