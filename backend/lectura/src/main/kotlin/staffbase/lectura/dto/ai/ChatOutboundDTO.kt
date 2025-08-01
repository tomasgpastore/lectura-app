package staffbase.lectura.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty
import staffbase.lectura.ai.SearchType

data class ChatOutboundDTO(
    @JsonProperty("course_id")
    val courseId: String,
    @JsonProperty("user_id")
    val userId: String,
    @JsonProperty("user_prompt")
    val userPrompt: String,
    @JsonProperty("slide_priority")
    val slidePriority: List<String> = emptyList(),
    @JsonProperty("search_type")
    val searchType: String = "DEFAULT",
    @JsonProperty("snapshots")
    val snapshots: List<String> = emptyList(),
)