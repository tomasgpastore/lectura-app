package staffbase.lectura.ai.chat

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import staffbase.lectura.auth.JwtService

@RestController
@RequestMapping("/chat")
class ChatController(
    private val chatService: ChatService,
    private val jwtService: JwtService
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
        @RequestHeader("Authorization") authHeader: String,
        @PathVariable courseId: String
    ): ResponseEntity<List<ChatMessage>> {
        val userId = jwtService.extractUserIdFromHeader(authHeader)
        val messages = chatService.getLast10(userId, courseId)
        return ResponseEntity.ok(messages)
    }

    @DeleteMapping("/{courseId}")
    fun clearChat(
        @RequestHeader("Authorization") authHeader: String,
        @PathVariable courseId: String
    ): ResponseEntity<Void> {
        val userId = jwtService.extractUserIdFromHeader(authHeader)
        chatService.clearChat(userId, courseId)
        return ResponseEntity.noContent().build()
    }
}