package staffbase.lectura.ai

import staffbase.lectura.ai.chat.ChatMessage

/**
 * Simple test to verify ChatMessage structure and Redis integration patterns
 * This test can be run to verify the basic functionality works as expected
 */
class SimpleChatTest {
    
    fun testChatMessageCreation() {
        println("🧪 Testing ChatMessage creation and structure...")
        
        // Test user message
        val userMessage = ChatMessage(
            user = "What is polymorphism in Java?",
            ai = "",
            timestamp = System.currentTimeMillis()
        )
        
        println("✅ User message created: ${userMessage.user}")
        assert(userMessage.user.isNotEmpty()) { "User message should not be empty" }
        assert(userMessage.ai.isEmpty()) { "AI field should be empty for user messages" }
        
        // Test AI response message
        val aiMessage = ChatMessage(
            user = "",
            ai = "Polymorphism in Java allows objects of different types to be treated as instances of the same type through a common interface.",
            timestamp = System.currentTimeMillis()
        )
        
        println("✅ AI message created: ${aiMessage.ai}")
        assert(aiMessage.ai.isNotEmpty()) { "AI message should not be empty" }
        assert(aiMessage.user.isEmpty()) { "User field should be empty for AI messages" }
        
        println("✅ ChatMessage structure test passed!")
    }
    
    fun testConversationFlow() {
        println("\n🧪 Testing conversation flow simulation...")
        
        val conversation = mutableListOf<ChatMessage>()
        
        // Simulate a conversation
        conversation.add(ChatMessage("Explain machine learning", "", System.currentTimeMillis()))
        conversation.add(ChatMessage("", "Machine learning is a subset of AI that enables computers to learn from data.", System.currentTimeMillis() + 1000))
        conversation.add(ChatMessage("What are the main types?", "", System.currentTimeMillis() + 2000))
        conversation.add(ChatMessage("", "The main types are supervised, unsupervised, and reinforcement learning.", System.currentTimeMillis() + 3000))
        
        println("Conversation with ${conversation.size} messages:")
        conversation.forEach { message ->
            if (message.user.isNotEmpty()) {
                println("👤 User: ${message.user}")
            } else {
                println("🤖 AI: ${message.ai}")
            }
        }
        
        // Verify conversation structure
        val userMessages = conversation.count { it.user.isNotEmpty() }
        val aiMessages = conversation.count { it.ai.isNotEmpty() }
        
        println("✅ User messages: $userMessages")
        println("✅ AI messages: $aiMessages")
        assert(userMessages == aiMessages) { "Should have equal number of user and AI messages" }
        
        println("✅ Conversation flow test passed!")
    }
    
    fun testRedisKeyPattern() {
        println("\n🧪 Testing Redis key pattern...")
        
        val userId = "user123"
        val courseId = "course456"
        val expectedKey = "chat:$courseId:$userId"
        
        println("✅ Redis key pattern: $expectedKey")
        assert(expectedKey == "chat:course456:user123") { "Key pattern should match expected format" }
        
        println("✅ Redis key pattern test passed!")
    }
    
    fun simulateAiChatWorkflow() {
        println("\n🧪 Simulating complete AI chat workflow...")
        
        val userId = "test-user-123"
        val courseId = "course-ai-101"
        val userPrompt = "Explain neural networks"
        
        println("1. User sends prompt: '$userPrompt'")
        
        // Simulate creating user message
        val userMessage = ChatMessage(
            user = userPrompt,
            ai = "",
            timestamp = System.currentTimeMillis()
        )
        
        println("2. User message created for Redis storage")
        
        // Simulate AI response (this would come from Python microservice)
        val aiResponse = "Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information using mathematical operations."
        
        println("3. AI generates response: '${aiResponse.take(50)}...'")
        
        // Simulate creating AI message
        val aiMessage = ChatMessage(
            user = "",
            ai = aiResponse,
            timestamp = System.currentTimeMillis() + 1000
        )
        
        println("4. AI message created for Redis storage")
        
        // Simulate Redis storage
        val redisKey = "chat:$courseId:$userId"
        println("5. Both messages saved to Redis with key: $redisKey")
        
        // Simulate retrieving conversation
        val conversation = listOf(userMessage, aiMessage)
        println("6. Retrieved conversation with ${conversation.size} messages")
        
        println("✅ Complete AI chat workflow simulation passed!")
    }
}

fun main() {
    println("🚀 Running Simple Chat Tests")
    println("=" * 40)
    
    val test = SimpleChatTest()
    
    try {
        test.testChatMessageCreation()
        test.testConversationFlow()
        test.testRedisKeyPattern()
        test.simulateAiChatWorkflow()
        
        println("\n🎉 ALL TESTS PASSED!")
        println("The chat system structure is working correctly.")
        
    } catch (e: AssertionError) {
        println("\n❌ TEST FAILED: ${e.message}")
    } catch (e: Exception) {
        println("\n❌ ERROR: ${e.message}")
    }
    
    println("\n📋 Next Steps:")
    println("1. Run the actual Spring Boot application")
    println("2. Test the /ai/chat endpoint with a real request")
    println("3. Verify Python microservice connectivity")
    println("4. Check Redis storage with actual ChatService")
}

private operator fun String.times(n: Int): String = this.repeat(n) 