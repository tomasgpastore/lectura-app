package staffbase.lectura.dto.ai

import jakarta.validation.constraints.NotBlank

data class ChatFrontDTO(
    @field:NotBlank val courseId: String,
    @field:NotBlank val userPrompt: String,
    val snapshot: String? = null
)
