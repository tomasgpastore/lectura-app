package staffbase.lectura.chat

import com.fasterxml.jackson.databind.ObjectMapper
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.verify
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import staffbase.lectura.ai.chat.ChatController
import staffbase.lectura.ai.chat.ChatMessage
import staffbase.lectura.ai.chat.ChatService
import staffbase.lectura.auth.JwtService

@ExtendWith(SpringExtension::class)
@WebMvcTest(ChatController::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ChatControllerTest {

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockkBean
    private lateinit var chatService: ChatService

    @MockkBean
    private lateinit var jwtService: JwtService

    @BeforeEach
    fun resetMocks() {
        clearMocks(chatService, jwtService)
    }

    val userId = "user123"
    val courseId = "course456"
    val authHeader = "Bearer valid-jwt-token"
    
    val chatMessage = ChatMessage(
        user = "Hello, can you help me with this topic?",
        ai = "Of course! I'd be happy to help you understand this topic.",
        timestamp = System.currentTimeMillis()
    )
    
    val chatMessages = listOf(
        ChatMessage("What is polymorphism?", "Polymorphism is a core concept in OOP...", 1234567890L),
        ChatMessage("Can you give an example?", "Sure! Here's a simple example...", 1234567891L),
        chatMessage
    )

    @Test
    fun `should post message successfully`() {
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.addMessage(userId, courseId, chatMessage) } returns Unit

        mockMvc.post("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(chatMessage)
        }
        .andExpect {
            status { isCreated() }
        }

        verify { chatService.addMessage(userId, courseId, chatMessage) }
    }

    @Test
    fun `should get messages successfully`() {
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.getLast10(userId, courseId) } returns chatMessages

        mockMvc.get("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
        }
        .andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(chatMessages)) }
        }

        verify { chatService.getLast10(userId, courseId) }
    }

    @Test
    fun `should get empty list when no messages exist`() {
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.getLast10(userId, courseId) } returns emptyList()

        mockMvc.get("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
        }
        .andExpect {
            status { isOk() }
            content { json("[]") }
        }

        verify { chatService.getLast10(userId, courseId) }
    }

    @Test
    fun `should clear chat successfully`() {
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.clearChat(userId, courseId) } returns Unit

        mockMvc.delete("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
        }
        .andExpect {
            status { isNoContent() }
        }

        verify { chatService.clearChat(userId, courseId) }
    }

    @Test
    fun `should handle missing authorization header`() {
        mockMvc.post("/chat/{courseId}", courseId) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(chatMessage)
        }
        .andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun `should handle AI generated conversation flow`() {
        // Simulate AI conversation where user asks a question and AI responds
        val userPrompt = "Explain machine learning"
        val aiResponse = "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed."
        
        val userMessage = ChatMessage(
            user = userPrompt,
            ai = "",
            timestamp = System.currentTimeMillis()
        )
        
        val aiMessage = ChatMessage(
            user = "",
            ai = aiResponse,
            timestamp = System.currentTimeMillis()
        )
        
        val conversationMessages = listOf(userMessage, aiMessage)
        
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.getLast10(userId, courseId) } returns conversationMessages

        mockMvc.get("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
        }
        .andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(conversationMessages)) }
        }

        verify { chatService.getLast10(userId, courseId) }
    }

    @Test
    fun `should handle conversation with multiple exchanges`() {
        // Simulate a longer conversation
        val conversationFlow = listOf(
            ChatMessage("What is polymorphism?", "", 1000L),
            ChatMessage("", "Polymorphism allows objects of different types to be treated as instances of the same type through a common interface.", 1001L),
            ChatMessage("Can you give a Java example?", "", 1002L),
            ChatMessage("", "Sure! Here's an example with Shape interface and Circle, Rectangle classes implementing it.", 1003L),
            ChatMessage("What about method overloading vs overriding?", "", 1004L),
            ChatMessage("", "Method overloading is compile-time polymorphism, while method overriding is runtime polymorphism.", 1005L)
        )
        
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.getLast10(userId, courseId) } returns conversationFlow

        mockMvc.get("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
        }
        .andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(conversationFlow)) }
        }

        verify { chatService.getLast10(userId, courseId) }
    }

    @Test
    fun `should save AI response after streaming completes`() {
        // Test that AI responses are properly saved to Redis
        val aiGeneratedMessage = ChatMessage(
            user = "",
            ai = "Based on the slides you uploaded, I can explain that neural networks are computational models inspired by biological neural networks.",
            timestamp = System.currentTimeMillis()
        )
        
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { chatService.addMessage(userId, courseId, aiGeneratedMessage) } returns Unit

        mockMvc.post("/chat/{courseId}", courseId) {
            header("Authorization", authHeader)
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(aiGeneratedMessage)
        }
        .andExpect {
            status { isCreated() }
        }

        verify { chatService.addMessage(userId, courseId, aiGeneratedMessage) }
    }
} 