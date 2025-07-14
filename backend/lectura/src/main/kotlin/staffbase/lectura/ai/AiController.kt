package staffbase.lectura.ai

import jakarta.validation.Valid
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import staffbase.lectura.auth.JwtService
import staffbase.lectura.dto.ai.ChatFrontDTO
import staffbase.lectura.dto.ai.ChatResponseDTO

@RestController
@RequestMapping("/ai")
class AiController(
    private val aiChatService: AiChatService,
    private val jwtService: JwtService
) {

    @PostMapping("/chat"
        //, produces = [MediaType.TEXT_EVENT_STREAM_VALUE]
        )
    fun generateAnswer(
        @RequestHeader("Authorization") authHeader: String,
        @RequestBody @Valid request: ChatFrontDTO
    ): ChatResponseDTO {
        val userId = jwtService.extractUserIdFromHeader(authHeader)
        
        return aiChatService.generateAnswer(
            userId = userId,
            courseId = request.courseId,
            userPrompt = request.userPrompt,
            snapshot = request.snapshot
        )
    }
}
