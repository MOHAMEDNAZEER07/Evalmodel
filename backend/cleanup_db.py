"""
Script to clean up database records for datasets and models
Run this after deleting files from Supabase Storage
"""
import asyncio
from app.core.config import settings
from supabase import create_client

async def cleanup_database():
    """Delete all datasets and models for a user from the database"""
    
    # Initialize Supabase client
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    
    # Your user ID (from the logs)
    user_id = "925b416f-a3ff-422d-a299-a5e8803169a6"
    
    print("🧹 Starting database cleanup...")
    print(f"User ID: {user_id}\n")
    
    # Delete all evaluations first (foreign key constraints)
    print("📊 Deleting evaluations...")
    eval_result = supabase.table("evaluations").delete().eq("user_id", user_id).execute()
    print(f"   Deleted {len(eval_result.data) if eval_result.data else 0} evaluations\n")
    
    # Delete all models
    print("🤖 Deleting models...")
    model_result = supabase.table("models").delete().eq("user_id", user_id).execute()
    print(f"   Deleted {len(model_result.data) if model_result.data else 0} models\n")
    
    # Delete all datasets
    print("📁 Deleting datasets...")
    dataset_result = supabase.table("datasets").delete().eq("user_id", user_id).execute()
    print(f"   Deleted {len(dataset_result.data) if dataset_result.data else 0} datasets\n")
    
    print("✅ Database cleanup complete!")
    print("🔄 Refresh your web application to see the changes.")

if __name__ == "__main__":
    asyncio.run(cleanup_database())
