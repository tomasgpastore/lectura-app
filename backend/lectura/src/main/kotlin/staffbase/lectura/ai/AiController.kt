package staffbase.lectura.ai

import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import staffbase.lectura.auth.AuthenticationService
import staffbase.lectura.dto.ai.ChatFrontDTO
import staffbase.lectura.dto.ai.ChatResponseDTO
import staffbase.lectura.dto.ai.Snapshot
import com.fasterxml.jackson.databind.ObjectMapper
import staffbase.lectura.subscription.SubscriptionLimitService
import staffbase.lectura.exception.SubscriptionLimitException
import kotlinx.coroutines.runBlocking

@RestController
@RequestMapping("/ai")
class AiController(
    private val aiChatService: AiChatService,
    private val authenticationService: AuthenticationService,
    private val objectMapper: ObjectMapper,
    private val subscriptionLimitService: SubscriptionLimitService
) {

    @PostMapping("/chat", consumes = ["multipart/form-data"])
    fun generateAnswer(
        @RequestPart("data") @Valid requestJson: String,
        @RequestPart("image", required = false) image: MultipartFile?
    ): ChatResponseDTO = runBlocking {
        val userId = authenticationService.requireCurrentUserId()
        
        // Parse the JSON request data
        val request = objectMapper.readValue(requestJson, ChatFrontDTO::class.java)
        
        // Check message limit
        val messageLimitCheck = subscriptionLimitService.checkMessageLimit(userId)
        if (!messageLimitCheck.allowed) {
            throw SubscriptionLimitException(
                reason = messageLimitCheck.reason ?: "Daily message limit reached",
                limit = messageLimitCheck.limit,
                current = messageLimitCheck.current,
                requiredPlan = messageLimitCheck.requiredPlan
            )
        }
        
        // Check search type allowed
        val searchTypeCheck = subscriptionLimitService.checkSearchTypeAllowed(userId, request.searchType.name)
        if (!searchTypeCheck.allowed) {
            throw SubscriptionLimitException(
                reason = searchTypeCheck.reason ?: "Search type not available in your plan",
                requiredPlan = searchTypeCheck.requiredPlan
            )
        }
        
        // Process the image if provided
        val processedSnapshot = if (image != null && request.snapshot != null) {
            aiChatService.processSnapshotWithImage(
                snapshot = request.snapshot,
                imageFile = image
            )
        } else {
            null
        }
        
        val response = aiChatService.generateAnswer(
            userId = userId,
            courseId = request.courseId,
            userPrompt = request.userPrompt,
            priorityDocuments = request.priorityDocuments,
            searchType = request.searchType,
            snapshotOutbound = processedSnapshot
        )
        
        // Increment message count after successful response
        subscriptionLimitService.incrementMessageCount(userId)
        
        response
    }
    
    @PostMapping("/chat/json")
    fun generateAnswerJson(
        @RequestBody @Valid request: ChatFrontDTO
    ): ChatResponseDTO = runBlocking {
        val userId = authenticationService.requireCurrentUserId()
        
        // Check message limit
        val messageLimitCheck = subscriptionLimitService.checkMessageLimit(userId)
        if (!messageLimitCheck.allowed) {
            throw SubscriptionLimitException(
                reason = messageLimitCheck.reason ?: "Daily message limit reached",
                limit = messageLimitCheck.limit,
                current = messageLimitCheck.current,
                requiredPlan = messageLimitCheck.requiredPlan
            )
        }
        
        // Check search type allowed
        val searchTypeCheck = subscriptionLimitService.checkSearchTypeAllowed(userId, request.searchType.name)
        if (!searchTypeCheck.allowed) {
            throw SubscriptionLimitException(
                reason = searchTypeCheck.reason ?: "Search type not available in your plan",
                requiredPlan = searchTypeCheck.requiredPlan
            )
        }
        
        val response = aiChatService.generateAnswer(
            userId = userId,
            courseId = request.courseId,
            userPrompt = request.userPrompt,
            priorityDocuments = request.priorityDocuments,
            searchType = request.searchType,
            snapshotOutbound = null
        )
        
        // Increment message count after successful response
        subscriptionLimitService.incrementMessageCount(userId)
        
        response
    }
}
