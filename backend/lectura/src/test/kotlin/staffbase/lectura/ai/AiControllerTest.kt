package staffbase.lectura.ai

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
import org.springframework.test.web.servlet.post
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import staffbase.lectura.auth.JwtService
import staffbase.lectura.dto.ai.ChatRequestDTO

@ExtendWith(SpringExtension::class)
@WebMvcTest(AiController::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AiControllerTest {

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockkBean
    private lateinit var aiChatService: AiChatService

    @MockkBean
    private lateinit var jwtService: JwtService

    @BeforeEach
    fun resetMocks() {
        clearMocks(aiChatService, jwtService)
    }

    val userId = "user123"
    val courseId = "course456"
    val authHeader = "Bearer valid-jwt-token"
    
    val chatRequest = ChatRequestDTO(
        courseId = courseId,
        userPrompt = "Explain polymorphism in Java",
        snapshot = null
    )
    
    val chatRequestWithSnapshot = ChatRequestDTO(
        courseId = courseId,
        userPrompt = "What does this slide show?",
        snapshot = "base64encodedimage=="
    )

    @Test
    fun `should generate AI answer successfully`() {
        val mockEmitter = SseEmitter()
        
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { 
            aiChatService.generateAnswer(userId, courseId, chatRequest.userPrompt, null) 
        } returns mockEmitter

        mockMvc.post("/ai/chat") {
            header("Authorization", authHeader)
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(chatRequest)
        }
        .andExpect {
            status { isOk() }
            // Note: Content-Type header is set by the framework during actual SSE streaming
            // In unit tests with MockMvc, this header isn't set since no actual streaming occurs
        }

        verify { aiChatService.generateAnswer(userId, courseId, chatRequest.userPrompt, null) }
    }

    @Test
    fun `should generate AI answer with snapshot successfully`() {
        val mockEmitter = SseEmitter()
        
        every { jwtService.extractUserIdFromHeader(authHeader) } returns userId
        every { 
            aiChatService.generateAnswer(userId, courseId, chatRequestWithSnapshot.userPrompt, chatRequestWithSnapshot.snapshot) 
        } returns mockEmitter

        mockMvc.post("/ai/chat") {
            header("Authorization", authHeader)
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(chatRequestWithSnapshot)
        }
        .andExpect {
            status { isOk() }
        }

        verify { 
            aiChatService.generateAnswer(userId, courseId, chatRequestWithSnapshot.userPrompt, chatRequestWithSnapshot.snapshot) 
        }
    }

    @Test
    fun `should reject request with missing courseId`() {
        val invalidRequest = ChatRequestDTO(
            courseId = "",
            userPrompt = "Test prompt",
            snapshot = null
        )

        mockMvc.post("/ai/chat") {
            header("Authorization", authHeader)
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(invalidRequest)
        }
        .andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun `should reject request with missing userPrompt`() {
        val invalidRequest = ChatRequestDTO(
            courseId = courseId,
            userPrompt = "",
            snapshot = null
        )

        mockMvc.post("/ai/chat") {
            header("Authorization", authHeader)
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(invalidRequest)
        }
        .andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun `should reject request without authorization header`() {
        mockMvc.post("/ai/chat") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(chatRequest)
        }
        .andExpect {
            status { isBadRequest() }
        }
    }
} 