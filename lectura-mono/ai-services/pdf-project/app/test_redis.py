from upstash_redis import Redis
from app.config import get_env_var
import sys

def test_redis_connection():
    """Test Redis connection using app config for environment variables"""
    try:
        print("🔌 Testing Redis connection with app config...")
        
        # Get Redis credentials from app config
        redis_url = get_env_var("UPSTASH_REDIS_REST_URL")
        redis_token = get_env_var("UPSTASH_REDIS_REST_TOKEN")
        
        if not redis_url or not redis_token:
            print("❌ Missing Redis environment variables")
            print("💡 Required: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN")
            return False
        
        print(f"📋 Using Redis URL from config: {redis_url[:30]}...")
        
        # Create Redis client using app config credentials
        redis = Redis(url=redis_url, token=redis_token)
        
        print("📝 Setting test value...")
        redis.set("foo", "bar")
        
        print("📖 Getting test value...")
        value = redis.get("foo")
        
        if value == "bar":
            print("✅ Redis connection successful!")
            print(f"📊 Retrieved value: {value}")
            
            # Clean up test data
            redis.delete("foo")
            print("🧹 Cleaned up test data")
            return True
        else:
            print(f"❌ Unexpected value retrieved: {value}")
            return False
            
    except Exception as e:
        print(f"❌ Redis connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_redis_connection()
    print(f"\n{'✅ SUCCESS' if success else '❌ FAILED'}")
    sys.exit(0 if success else 1)