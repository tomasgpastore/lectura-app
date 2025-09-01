package staffbase.lectura.dto.subscription

data class WebhookEventResponseDTO(
    val eventId: String,
    val eventType: String,
    val processed: Boolean = true
)