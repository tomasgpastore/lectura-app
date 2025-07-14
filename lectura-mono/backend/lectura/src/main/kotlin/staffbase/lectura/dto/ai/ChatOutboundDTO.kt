package staffbase.lectura.dto.ai

data class ChatOutboundDTO(
    val courseId: String,
    val userId: String,
    val userPrompt: String,
    val snapshot: String? = null
)