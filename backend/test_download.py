"""
Test different download methods for Supabase Storage
"""
from app.core.config import settings
from supabase import create_client
import io
import pandas as pd

def test_downloads():
    """Test various download approaches"""
    
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    user_id = "925b416f-a3ff-422d-a299-a5e8803169a6"
    filename = "e71127c7-af14-4cd1-b500-9b9773f08244.csv"
    
    print("🧪 Testing different download methods...\n")
    
    # Method 1: Full path with user folder
    print("Method 1: Full path (user_id/filename)")
    try:
        path = f"{user_id}/{filename}"
        data = supabase.storage.from_("datasets").download(path)
        df = pd.read_csv(io.BytesIO(data))
        print(f"   ✅ SUCCESS - Downloaded {len(data)} bytes, {len(df)} rows")
    except Exception as e:
        print(f"   ❌ FAILED - {e}")
    
    print()
    
    # Method 2: Just filename
    print("Method 2: Filename only")
    try:
        data = supabase.storage.from_("datasets").download(filename)
        df = pd.read_csv(io.BytesIO(data))
        print(f"   ✅ SUCCESS - Downloaded {len(data)} bytes, {len(df)} rows")
    except Exception as e:
        print(f"   ❌ FAILED - {e}")
    
    print()
    
    # Method 3: List files in user folder
    print("Method 3: List files in user folder")
    try:
        files = supabase.storage.from_("datasets").list(user_id)
        print(f"   Found {len(files)} file(s):")
        for file in files:
            print(f"   - {file['name']}")
    except Exception as e:
        print(f"   ❌ FAILED - {e}")
    
    print()
    
    # Method 4: List files at root
    print("Method 4: List files at root")
    try:
        files = supabase.storage.from_("datasets").list()
        print(f"   Found {len(files)} item(s):")
        for file in files:
            print(f"   - {file['name']} (type: {file.get('id', 'folder' if file.get('name') else 'file')})")
    except Exception as e:
        print(f"   ❌ FAILED - {e}")
    
    print()
    
    # Method 5: Get public URL
    print("Method 5: Get public URL")
    try:
        path = f"{user_id}/{filename}"
        url = supabase.storage.from_("datasets").get_public_url(path)
        print(f"   Public URL: {url}")
    except Exception as e:
        print(f"   ❌ FAILED - {e}")

if __name__ == "__main__":
    test_downloads()
