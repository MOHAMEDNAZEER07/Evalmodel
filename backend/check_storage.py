"""
Check Supabase Storage to see what files exist
"""
from app.core.config import settings
from supabase import create_client

def check_storage():
    """Check what files exist in storage buckets"""
    
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    user_id = "925b416f-a3ff-422d-a299-a5e8803169a6"
    
    print("🔍 Checking Supabase Storage...\n")
    
    # Check datasets bucket
    print("📁 DATASETS BUCKET:")
    try:
        files = supabase.storage.from_("datasets").list(user_id)
        if files:
            print(f"   Found {len(files)} file(s):")
            for file in files:
                print(f"   - {file['name']}")
        else:
            print("   No files found")
    except Exception as e:
        print(f"   Error: {e}")
    
    print()
    
    # Check models bucket
    print("🤖 MODELS BUCKET:")
    try:
        files = supabase.storage.from_("models").list(user_id)
        if files:
            print(f"   Found {len(files)} file(s):")
            for file in files:
                print(f"   - {file['name']}")
        else:
            print("   No files found")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "="*60)
    print("Now trying to download a file...")
    print("="*60 + "\n")
    
    # Try to download the dataset file
    file_path = f"{user_id}/e71127c7-af14-4cd1-b500-9b9773f08244.csv"
    print(f"📥 Attempting to download: {file_path}")
    try:
        data = supabase.storage.from_("datasets").download(file_path)
        print(f"✅ SUCCESS! Downloaded {len(data)} bytes")
    except Exception as e:
        print(f"❌ FAILED: {e}")

if __name__ == "__main__":
    check_storage()
