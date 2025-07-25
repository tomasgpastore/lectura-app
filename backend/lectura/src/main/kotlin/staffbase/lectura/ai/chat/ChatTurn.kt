package staffbase.lectura.ai.chat

import org.bson.types.ObjectId
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import java.time.Instant

@Document(collection = "chat_turns")
data class ChatTurn(
    @Id
    val id: ObjectId = ObjectId(),
    val userId: String,
    val courseId: String,
    val userMessage: ChatMessage,
    val assistantMessage: ChatMessage,
    val timestamp: Instant = Instant.now()
)
