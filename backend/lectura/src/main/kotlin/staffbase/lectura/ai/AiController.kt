package staffbase.lectura.ai

import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*
import staffbase.lectura.auth.AuthenticationService
import staffbase.lectura.dto.ai.ChatFrontDTO
import staffbase.lectura.dto.ai.ChatResponseDTO

@RestController
@RequestMapping("/ai")
class AiController(
    private val aiChatService: AiChatService,
    private val authenticationService: AuthenticationService
) {

    @PostMapping("/chat"
        //, produces = [MediaType.TEXT_EVENT_STREAM_VALUE]
        )
    fun generateAnswer(
        @RequestBody @Valid request: ChatFrontDTO
    ): ChatResponseDTO {
        val userId = authenticationService.requireCurrentUserId()
        
        return aiChatService.generateAnswer(
            userId = userId,
            courseId = request.courseId,
            userPrompt = request.userPrompt,
            slidePriority = request.slidePriority,
            searchType = request.searchType,
            snapshots = request.snapshots,
        )
    }
}
