import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from django.apps import apps
from django.db import connections, transaction

def migrate_db():
    print("Starting data migration from SQLite to Supabase PostgreSQL...")
    
    # Models to migrate in topological dependency order to avoid foreign key errors:
    models_to_migrate = [
        # Django internal tables (Auth & Contenttypes)
        'auth.Group',
        'auth.User',
        
        # inventory app
        'inventory.UserProfile',
        'inventory.Doctor',
        'inventory.MedicineCategory',
        'inventory.Medicine',
        'inventory.MedicalCampVenue',
        'inventory.MedicalCamp',
        'inventory.Patient',
        'inventory.PatientCampVisit',
        'inventory.CampWiseStock',
        'inventory.CampWiseDoctor',
        'inventory.PatientMedicineIssue',
        'inventory.Vitals',
        'inventory.PatientVitals',
        'inventory.MedicalTest',
        'inventory.TestIssue',
        'inventory.ScanSession',
        'inventory.ManualPatientRecord',
        
        # voicebot app
        'voicebot.CampVoiceReminder',
        'voicebot.CallSchedule',
        'voicebot.VoiceCall',
        'voicebot.VoiceResponse',
    ]
    
    # Check if 'supabase' database configuration is present
    if 'supabase' not in connections:
        print("ERROR: 'supabase' database settings not found in settings.py.")
        print("Please configure DATABASES['supabase'] in settings.py first.")
        return
        
    try:
        # We use a database transaction on the supabase database
        with transaction.atomic(using='supabase'):  # type: ignore
            # Temporarily disable foreign key constraints to prevent ordering issues
            with connections['supabase'].cursor() as cursor:
                cursor.execute("SET CONSTRAINTS ALL DEFERRED;")
                
            for model_label in models_to_migrate:
                model = apps.get_model(model_label)
                print(f"Migrating {model_label}...")
                
                # Fetch all from default database (SQLite)
                records = list(model.objects.using('default').all())
                total = len(records)
                
                # Delete existing records in supabase model to prevent duplicate keys
                model.objects.using('supabase').all().delete()
                
                # Bulk create:
                if records:
                    model.objects.using('supabase').bulk_create(records)
                print(f"  Successfully migrated {total} records.")
                
        print("\nData migration finished! Now syncing PostgreSQL primary key sequences...")
        sync_sequences()
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"\nMigration failed with error: {e}")

def sync_sequences():
    with connections['supabase'].cursor() as cursor:
        # Get all table names in the public schema
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        for table in tables:
            # Check if table has an 'id' column
            cursor.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{table}' AND column_name = 'id'
            """)
            if cursor.fetchone():
                try:
                    # Sync the ID sequence to match the max ID in the table
                    cursor.execute(f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{table}"', 'id'), 
                            coalesce(max(id), 1), 
                            max(id) IS NOT null
                        ) FROM "{table}";
                    """)
                    print(f"  Synced sequence for table: {table}")
                except Exception:
                    # If there's no sequence or it fails, skip
                    pass

if __name__ == '__main__':
    migrate_db()
