package staffbase.lectura.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty

data class ChatOutboundDTO(
    @JsonProperty("course_id")
    val courseId: String,
    @JsonProperty("user_id")
    val userId: String,
    @JsonProperty("user_prompt")
    val userPrompt: String,
    val snapshot: String? = null
)