package staffbase.lectura.ai

import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import staffbase.lectura.auth.AuthenticationService
import staffbase.lectura.dto.ai.ChatFrontDTO
import staffbase.lectura.dto.ai.ChatResponseDTO
import staffbase.lectura.dto.ai.Snapshot
import com.fasterxml.jackson.databind.ObjectMapper

@RestController
@RequestMapping("/ai")
class AiController(
    private val aiChatService: AiChatService,
    private val authenticationService: AuthenticationService,
    private val objectMapper: ObjectMapper
) {

    @PostMapping("/chat", consumes = ["multipart/form-data"])
    fun generateAnswer(
        @RequestPart("data") @Valid requestJson: String,
        @RequestPart("image", required = false) image: MultipartFile?
    ): ChatResponseDTO {
        val userId = authenticationService.requireCurrentUserId()
        
        // Parse the JSON request data
        val request = objectMapper.readValue(requestJson, ChatFrontDTO::class.java)
        
        // Process the image if provided
        val processedSnapshot = if (image != null && request.snapshot != null) {
            aiChatService.processSnapshotWithImage(
                snapshot = request.snapshot,
                imageFile = image
            )
        } else {
            null
        }
        
        return aiChatService.generateAnswer(
            userId = userId,
            courseId = request.courseId,
            userPrompt = request.userPrompt,
            priorityDocuments = request.priorityDocuments,
            searchType = request.searchType,
            snapshotOutbound = processedSnapshot
        )
    }
    
    @PostMapping("/chat/json")
    fun generateAnswerJson(
        @RequestBody @Valid request: ChatFrontDTO
    ): ChatResponseDTO {
        val userId = authenticationService.requireCurrentUserId()
        
        return aiChatService.generateAnswer(
            userId = userId,
            courseId = request.courseId,
            userPrompt = request.userPrompt,
            priorityDocuments = request.priorityDocuments,
            searchType = request.searchType,
            snapshotOutbound = null
        )
    }
}
