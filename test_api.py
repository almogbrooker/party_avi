import os
try:
    from google import genai
except ImportError:
    print("Please install: pip install google-genai")
    exit(1)

# Test your API key
api_key = "AIzaSyCd3Bf_U30uxcBBalQH2QQMjVMeTIdNvO8"

print("Testing Gemini API...")
try:
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents="Explain how AI works in a few words"
    )

    print("✅ API Key works!")
    print("\nResponse:")
    print(response.text)

except Exception as e:
    print("❌ Error:")
    print(str(e))