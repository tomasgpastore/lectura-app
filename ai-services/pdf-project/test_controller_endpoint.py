#!/usr/bin/env python3
"""
Test script for the controller endpoint with integrated pre-outbound analysis
"""

import sys
import asyncio
import json
import httpx

# Test the actual FastAPI endpoint
async def test_controller_endpoint():
    """Test the /outbound endpoint with different query types"""
    print("🧪 Testing Controller /outbound Endpoint")
    print("=" * 60)
    
    # Start the server first (in a separate terminal)
    base_url = "http://localhost:8000"
    
    test_cases = [
        {
            "name": "Information Query (should retrieve)",
            "request": {
                "course": "7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
                "user": "test_user_123",
                "prompt": "What does Peter Thiel say about monopolies in Zero to One?",
                "snapshot": None
            },
            "expected_sources": True
        },
        {
            "name": "Follow-up Query (should NOT retrieve)",
            "request": {
                "course": "7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
                "user": "test_user_123", 
                "prompt": "Can you explain that in simpler terms?",
                "snapshot": None
            },
            "expected_sources": False
        },
        {
            "name": "Greeting (should NOT retrieve)",
            "request": {
                "course": "7f36bacc-3b9d-4c50-9d66-a52f98dd12a9",
                "user": "test_user_123",
                "prompt": "Hello, how are you?",
                "snapshot": None
            },
            "expected_sources": False
        }
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n🧪 Test {i}: {test_case['name']}")
            print(f"Query: '{test_case['request']['prompt']}'")
            print(f"Expected sources: {test_case['expected_sources']}")
            
            try:
                # Make request to the endpoint
                response = await client.post(
                    f"{base_url}/outbound",
                    json=test_case["request"]
                )
                
                if response.status_code != 200:
                    print(f"❌ HTTP Error: {response.status_code}")
                    print(f"Response: {response.text}")
                    continue
                
                # Parse SSE stream
                sources_found = False
                token_count = 0
                
                # Process the SSE stream
                content = response.text
                lines = content.split('\n')
                
                for line in lines:
                    if line.startswith('event: sources'):
                        # Next line should have the data
                        continue
                    elif line.startswith('data: '):
                        data = line[6:]  # Remove 'data: ' prefix
                        try:
                            # Try to parse as JSON (sources)
                            sources_data = json.loads(data)
                            if isinstance(sources_data, list):
                                sources_found = len(sources_data) > 0
                                print(f"📚 Sources received: {len(sources_data)}")
                        except json.JSONDecodeError:
                            # This is a token
                            if data and data != "Stream completed":
                                token_count += 1
                                if token_count <= 3:  # Show first few tokens
                                    print(f"🤖 Token: {data[:50]}...")
                
                # Validate results
                if test_case["expected_sources"] == sources_found:
                    print(f"✅ PASS - Sources expectation met")
                else:
                    print(f"❌ FAIL - Expected sources: {test_case['expected_sources']}, Got: {sources_found}")
                
                print(f"📊 Total tokens received: {token_count}")
                
            except Exception as e:
                print(f"❌ Error: {str(e)}")
    
    print(f"\n✅ Controller endpoint tests completed!")

async def main():
    """Main test function"""
    print("🚀 Testing Controller with Integrated Pre-Outbound Pipeline")
    print("=" * 80)
    print("⚠️  Note: Make sure the server is running with: uvicorn app.controller:app --reload")
    print("=" * 80)
    
    await test_controller_endpoint()

if __name__ == "__main__":
    asyncio.run(main())