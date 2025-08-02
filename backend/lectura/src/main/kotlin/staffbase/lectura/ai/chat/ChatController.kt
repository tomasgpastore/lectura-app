package staffbase.lectura.ai.chat

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import staffbase.lectura.auth.AuthenticationService

@RestController
@RequestMapping("/chat")
class ChatController(
    private val chatService: ChatService,
    private val authenticationService: AuthenticationService
) {

//    @PostMapping("/{courseId}")
//    fun postMessage(
//        @RequestHeader("Authorization") authHeader: String,
//        @PathVariable courseId: String,
//        @RequestBody message: ChatMessage
//    ): ResponseEntity<Void> {
//        val userId = jwtService.extractUserIdFromHeader(authHeader)
//        chatService.addMessage(userId, courseId, message)
//        return ResponseEntity.status(HttpStatus.CREATED).build()
//    }

    @GetMapping("/{courseId}")
    fun getMessages(
        @PathVariable courseId: String
    ): ResponseEntity<List<ChatMessage>> {
        val userId = authenticationService.requireCurrentUserId()
        val messages = chatService.getMessages(userId, courseId)
        return ResponseEntity.ok(messages)
    }

    @DeleteMapping("/{courseId}")
    fun clearChat(
        @PathVariable courseId: String
    ): ResponseEntity<Void> {
        val userId = authenticationService.requireCurrentUserId()
        chatService.clearChat(userId, courseId)
        return ResponseEntity.noContent().build()
    }
}