package staffbase.lectura.dto.ai

data class ChatOutboundDTO(
    val course: String,
    val user: String,
    val prompt: String,
    val snapshot: String? = null
)